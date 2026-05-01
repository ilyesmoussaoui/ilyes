import type { Discipline, MemberDiscipline, Schedule, TimeSlot, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { CreateEnrollmentsInput } from './disciplines.types.js';

export class DisciplineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'DisciplineError';
  }
}

export async function listActiveDisciplines(): Promise<Discipline[]> {
  return prisma.discipline.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: 'asc' },
  });
}

export async function getTimeSlotsForDiscipline(disciplineId: string): Promise<TimeSlot[]> {
  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, deletedAt: null },
  });
  if (!discipline) {
    throw new DisciplineError('NOT_FOUND', 'Discipline not found', 404);
  }

  return prisma.timeSlot.findMany({
    where: { disciplineId, deletedAt: null },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

type InstructorResult = Pick<User, 'id' | 'fullNameLatin' | 'fullNameArabic'>;

export async function getInstructorsForDiscipline(
  _disciplineId: string,
): Promise<InstructorResult[]> {
  // Return all active coaches; discipline filtering can be added later when
  // an instructor-discipline mapping table is introduced.
  const coaches = await prisma.user.findMany({
    where: { role: 'coach', isActive: true, deletedAt: null },
    select: { id: true, fullNameLatin: true, fullNameArabic: true },
    orderBy: { fullNameLatin: 'asc' },
  });
  return coaches;
}

type TimeSlotWithDay = { id: string; dayOfWeek: number; startTime: string; endTime: string };

function detectConflicts(
  allSlots: TimeSlotWithDay[],
  schedules: Array<{ dayOfWeek: number; timeSlotId: string }>,
): string[] {
  const warnings: string[] = [];
  const slotMap = new Map(allSlots.map((s) => [s.id, s]));

  // Group schedules by dayOfWeek
  const byDay = new Map<number, Array<{ timeSlotId: string }>>();
  for (const sched of schedules) {
    const arr = byDay.get(sched.dayOfWeek) ?? [];
    arr.push(sched);
    byDay.set(sched.dayOfWeek, arr);
  }

  for (const [day, dayScheds] of byDay) {
    for (let i = 0; i < dayScheds.length; i++) {
      for (let j = i + 1; j < dayScheds.length; j++) {
        const slotA = slotMap.get(dayScheds[i]!.timeSlotId);
        const slotB = slotMap.get(dayScheds[j]!.timeSlotId);
        if (!slotA || !slotB) continue;
        // Check overlap: slotA.start < slotB.end && slotB.start < slotA.end
        if (slotA.startTime < slotB.endTime && slotB.startTime < slotA.endTime) {
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? `Day ${day}`;
          warnings.push(
            `Time conflict on ${dayName}: ${slotA.startTime}-${slotA.endTime} overlaps with ${slotB.startTime}-${slotB.endTime}`,
          );
        }
      }
    }
  }

  return warnings;
}

export type EnrollmentWithSchedules = MemberDiscipline & {
  schedules: (Schedule & { timeSlot: TimeSlot })[];
  discipline: Discipline;
};

export type CreateEnrollmentsResult = {
  enrollments: EnrollmentWithSchedules[];
  warnings: string[];
};

export async function createEnrollments(
  memberId: string,
  input: CreateEnrollmentsInput,
  _userId: string,
): Promise<CreateEnrollmentsResult> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
  });
  if (!member) {
    throw new DisciplineError('NOT_FOUND', 'Member not found', 404);
  }

  // Validate all discipline IDs exist
  const disciplineIds = input.enrollments.map((e) => e.disciplineId);
  const disciplines = await prisma.discipline.findMany({
    where: { id: { in: disciplineIds }, deletedAt: null, isActive: true },
  });
  if (disciplines.length !== new Set(disciplineIds).size) {
    throw new DisciplineError('VALIDATION_ERROR', 'One or more disciplines not found or inactive', 422);
  }

  // Validate all time slot IDs exist
  const allTimeSlotIds = input.enrollments.flatMap((e) => e.schedules.map((s) => s.timeSlotId));
  const timeSlots = await prisma.timeSlot.findMany({
    where: { id: { in: allTimeSlotIds }, deletedAt: null },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true, disciplineId: true },
  });
  const timeSlotMap = new Map(timeSlots.map((ts) => [ts.id, ts]));

  for (const enrollment of input.enrollments) {
    for (const sched of enrollment.schedules) {
      const ts = timeSlotMap.get(sched.timeSlotId);
      if (!ts) {
        throw new DisciplineError('VALIDATION_ERROR', `Time slot ${sched.timeSlotId} not found`, 422);
      }
      if (ts.disciplineId !== enrollment.disciplineId) {
        throw new DisciplineError(
          'VALIDATION_ERROR',
          `Time slot ${sched.timeSlotId} does not belong to discipline ${enrollment.disciplineId}`,
          422,
        );
      }
    }
  }

  // Validate instructor IDs if provided
  const instructorIds = input.enrollments
    .filter((e) => e.instructorId)
    .map((e) => e.instructorId!);
  if (instructorIds.length > 0) {
    const instructors = await prisma.user.findMany({
      where: { id: { in: instructorIds }, role: 'coach', isActive: true, deletedAt: null },
    });
    if (instructors.length !== new Set(instructorIds).size) {
      throw new DisciplineError('VALIDATION_ERROR', 'One or more instructors not found or not a coach', 422);
    }
  }

  // Detect time conflicts across all enrollments
  const allSchedules = input.enrollments.flatMap((e) => e.schedules);
  const warnings = detectConflicts(timeSlots, allSchedules);

  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // Transaction: delete existing + create new (replace strategy)
  const createdIds = await prisma.$transaction(async (tx) => {
    // Delete existing schedules for this member's disciplines
    const existingEnrollments = await tx.memberDiscipline.findMany({
      where: { memberId },
      select: { id: true },
    });
    const existingIds = existingEnrollments.map((e) => e.id);
    if (existingIds.length > 0) {
      await tx.schedule.deleteMany({
        where: { memberDisciplineId: { in: existingIds } },
      });
      await tx.memberDiscipline.deleteMany({
        where: { memberId },
      });
    }

    // Create new enrollments + schedules
    const ids: string[] = [];
    for (const enrollment of input.enrollments) {
      const md = await tx.memberDiscipline.create({
        data: {
          memberId,
          disciplineId: enrollment.disciplineId,
          instructorId: enrollment.instructorId ?? null,
          beltRank: enrollment.beltRank ?? null,
          enrollmentDate: todayDate,
          status: 'active',
        },
      });
      ids.push(md.id);

      if (enrollment.schedules.length > 0) {
        await tx.schedule.createMany({
          data: enrollment.schedules.map((s) => ({
            memberDisciplineId: md.id,
            dayOfWeek: s.dayOfWeek,
            timeSlotId: s.timeSlotId,
          })),
        });
      }
    }

    return ids;
  });

  // Fetch the created enrollments with full relations
  const enrollments = await prisma.memberDiscipline.findMany({
    where: { id: { in: createdIds } },
    include: {
      discipline: true,
      schedules: {
        include: { timeSlot: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return { enrollments, warnings };
}
