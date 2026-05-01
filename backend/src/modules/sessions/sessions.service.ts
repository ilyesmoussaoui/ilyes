import { prisma } from '../../lib/prisma.js';
import type {
  CreateTimeSlotInput,
  UpdateTimeSlotInput,
  MarkAttendanceInput,
  CheckConflictsInput,
  TimeSlotsQuery,
  EnrollMemberInput,
} from './sessions.types.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class SessionsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'SessionsError';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConflictWarning {
  type: 'coach_overlap' | 'room_overlap';
  message: string;
}

// ─── Conflict detection logic ────────────────────────────────────────────────

function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 < end2 && start2 < end1;
}

async function detectConflicts(params: {
  coachId?: string | null;
  room?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  excludeId?: string;
}): Promise<ConflictWarning[]> {
  const warnings: ConflictWarning[] = [];

  // Fetch all active time slots on the same day (excluding the current slot if updating)
  const existingSlots = await prisma.timeSlot.findMany({
    where: {
      dayOfWeek: params.dayOfWeek,
      deletedAt: null,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    include: {
      coach: { select: { id: true, fullNameLatin: true } },
      discipline: { select: { id: true, name: true } },
    },
  });

  for (const slot of existingSlots) {
    if (!timesOverlap(params.startTime, params.endTime, slot.startTime, slot.endTime)) {
      continue;
    }

    // Coach conflict
    if (
      params.coachId &&
      slot.coachId &&
      params.coachId === slot.coachId
    ) {
      const coachName = slot.coach?.fullNameLatin ?? 'Unknown';
      warnings.push({
        type: 'coach_overlap',
        message: `Coach "${coachName}" already has a session (${slot.discipline.name}) at ${slot.startTime}-${slot.endTime} on this day`,
      });
    }

    // Room conflict
    if (
      params.room &&
      slot.room &&
      params.room.toLowerCase() === slot.room.toLowerCase()
    ) {
      warnings.push({
        type: 'room_overlap',
        message: `Room "${slot.room}" is already booked for ${slot.discipline.name} at ${slot.startTime}-${slot.endTime} on this day`,
      });
    }
  }

  return warnings;
}

// ─── Get all active time slots ──────────────────────────────────────────────

export async function getTimeSlots(query: TimeSlotsQuery) {
  const where: { deletedAt: null; dayOfWeek?: number } = { deletedAt: null };
  if (query.dayOfWeek !== undefined) {
    where.dayOfWeek = query.dayOfWeek;
  }

  const timeSlots = await prisma.timeSlot.findMany({
    where,
    include: {
      discipline: {
        select: { id: true, name: true },
      },
      coach: {
        select: { id: true, fullNameLatin: true },
      },
      schedules: {
        where: {
          deletedAt: null,
          memberDiscipline: {
            deletedAt: null,
            status: 'active',
          },
        },
        select: { id: true },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  return timeSlots.map((slot) => ({
    id: slot.id,
    disciplineId: slot.disciplineId,
    discipline: { id: slot.discipline.id, name: slot.discipline.name },
    coachId: slot.coachId,
    coach: slot.coach ? { id: slot.coach.id, fullNameLatin: slot.coach.fullNameLatin } : null,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    maxCapacity: slot.maxCapacity,
    currentEnrollment: slot.schedules.length,
    room: slot.room,
  }));
}

// ─── Create a time slot ─────────────────────────────────────────────────────

export async function createTimeSlot(data: CreateTimeSlotInput) {
  // Verify discipline exists
  const discipline = await prisma.discipline.findFirst({
    where: { id: data.disciplineId, deletedAt: null },
  });
  if (!discipline) {
    throw new SessionsError('NOT_FOUND', 'Discipline not found', 404);
  }

  // Verify coach exists if provided
  if (data.coachId) {
    const coach = await prisma.user.findFirst({
      where: { id: data.coachId, deletedAt: null },
    });
    if (!coach) {
      throw new SessionsError('NOT_FOUND', 'Coach not found', 404);
    }
  }

  // Detect conflicts (warn, but still create)
  const warnings = await detectConflicts({
    coachId: data.coachId ?? null,
    room: data.room ?? null,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
  });

  const timeSlot = await prisma.timeSlot.create({
    data: {
      disciplineId: data.disciplineId,
      coachId: data.coachId ?? null,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      maxCapacity: data.maxCapacity,
      room: data.room ?? null,
    },
    include: {
      discipline: { select: { id: true, name: true } },
      coach: { select: { id: true, fullNameLatin: true } },
    },
  });

  return {
    timeSlot: {
      id: timeSlot.id,
      disciplineId: timeSlot.disciplineId,
      discipline: { id: timeSlot.discipline.id, name: timeSlot.discipline.name },
      coachId: timeSlot.coachId,
      coach: timeSlot.coach
        ? { id: timeSlot.coach.id, fullNameLatin: timeSlot.coach.fullNameLatin }
        : null,
      dayOfWeek: timeSlot.dayOfWeek,
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      maxCapacity: timeSlot.maxCapacity,
      room: timeSlot.room,
    },
    warnings,
  };
}

// ─── Update a time slot ─────────────────────────────────────────────────────

export async function updateTimeSlot(id: string, data: UpdateTimeSlotInput) {
  const existing = await prisma.timeSlot.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new SessionsError('NOT_FOUND', 'Time slot not found', 404);
  }

  // Verify discipline if provided
  if (data.disciplineId) {
    const discipline = await prisma.discipline.findFirst({
      where: { id: data.disciplineId, deletedAt: null },
    });
    if (!discipline) {
      throw new SessionsError('NOT_FOUND', 'Discipline not found', 404);
    }
  }

  // Verify coach if provided (non-null)
  if (data.coachId !== undefined && data.coachId !== null) {
    const coach = await prisma.user.findFirst({
      where: { id: data.coachId, deletedAt: null },
    });
    if (!coach) {
      throw new SessionsError('NOT_FOUND', 'Coach not found', 404);
    }
  }

  // Build the merged state for conflict detection
  const mergedDayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
  const mergedStartTime = data.startTime ?? existing.startTime;
  const mergedEndTime = data.endTime ?? existing.endTime;
  const mergedCoachId = data.coachId !== undefined ? data.coachId : existing.coachId;
  const mergedRoom = data.room !== undefined ? data.room : existing.room;

  // Validate startTime < endTime for merged state
  if (mergedStartTime >= mergedEndTime) {
    throw new SessionsError('VALIDATION_ERROR', 'startTime must be before endTime', 422);
  }

  const warnings = await detectConflicts({
    coachId: mergedCoachId,
    room: mergedRoom,
    dayOfWeek: mergedDayOfWeek,
    startTime: mergedStartTime,
    endTime: mergedEndTime,
    excludeId: id,
  });

  const updateData: Record<string, unknown> = {};
  if (data.disciplineId !== undefined) updateData.disciplineId = data.disciplineId;
  if (data.coachId !== undefined) updateData.coachId = data.coachId;
  if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.endTime !== undefined) updateData.endTime = data.endTime;
  if (data.maxCapacity !== undefined) updateData.maxCapacity = data.maxCapacity;
  if (data.room !== undefined) updateData.room = data.room;

  const timeSlot = await prisma.timeSlot.update({
    where: { id },
    data: updateData,
    include: {
      discipline: { select: { id: true, name: true } },
      coach: { select: { id: true, fullNameLatin: true } },
    },
  });

  return {
    timeSlot: {
      id: timeSlot.id,
      disciplineId: timeSlot.disciplineId,
      discipline: { id: timeSlot.discipline.id, name: timeSlot.discipline.name },
      coachId: timeSlot.coachId,
      coach: timeSlot.coach
        ? { id: timeSlot.coach.id, fullNameLatin: timeSlot.coach.fullNameLatin }
        : null,
      dayOfWeek: timeSlot.dayOfWeek,
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      maxCapacity: timeSlot.maxCapacity,
      room: timeSlot.room,
    },
    warnings,
  };
}

// ─── Soft-delete a time slot ────────────────────────────────────────────────

export async function deleteTimeSlot(id: string): Promise<void> {
  const existing = await prisma.timeSlot.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new SessionsError('NOT_FOUND', 'Time slot not found', 404);
  }

  await prisma.timeSlot.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ─── Get roster for a time slot ─────────────────────────────────────────────

export async function getTimeSlotRoster(id: string) {
  const timeSlot = await prisma.timeSlot.findFirst({
    where: { id, deletedAt: null },
    include: {
      discipline: { select: { id: true, name: true } },
      coach: { select: { id: true, fullNameLatin: true } },
    },
  });
  if (!timeSlot) {
    throw new SessionsError('NOT_FOUND', 'Time slot not found', 404);
  }

  // Get enrolled schedules with member info
  const schedules = await prisma.schedule.findMany({
    where: {
      timeSlotId: id,
      deletedAt: null,
      memberDiscipline: {
        deletedAt: null,
        status: 'active',
      },
    },
    include: {
      memberDiscipline: {
        include: {
          member: {
            select: {
              id: true,
              firstNameLatin: true,
              lastNameLatin: true,
              photoPath: true,
            },
          },
        },
      },
    },
  });

  // Get today's date boundaries for attendance lookup
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );

  // Collect member IDs for batch attendance query
  const memberIds = schedules.map((s) => s.memberDiscipline.member.id);

  // Fetch today's attendance for all roster members in one query
  const attendanceRecords = memberIds.length > 0
    ? await prisma.attendanceRecord.findMany({
        where: {
          memberId: { in: memberIds },
          disciplineId: timeSlot.disciplineId,
          checkInTime: { gte: startOfDay, lte: endOfDay },
          deletedAt: null,
        },
        select: {
          id: true,
          memberId: true,
          checkInTime: true,
        },
      })
    : [];

  // Index attendance by memberId for O(1) lookup
  const attendanceByMember = new Map<string, { id: string; checkInTime: Date }>();
  for (const record of attendanceRecords) {
    attendanceByMember.set(record.memberId, {
      id: record.id,
      checkInTime: record.checkInTime,
    });
  }

  const roster = schedules.map((schedule) => {
    const member = schedule.memberDiscipline.member;
    const attendance = attendanceByMember.get(member.id) ?? null;
    return {
      scheduleId: schedule.id,
      memberId: member.id,
      member: {
        id: member.id,
        firstNameLatin: member.firstNameLatin,
        lastNameLatin: member.lastNameLatin,
        photoPath: member.photoPath,
      },
      attendanceToday: attendance
        ? { id: attendance.id, checkInTime: attendance.checkInTime.toISOString() }
        : null,
    };
  });

  return {
    timeSlot: {
      id: timeSlot.id,
      discipline: { id: timeSlot.discipline.id, name: timeSlot.discipline.name },
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      maxCapacity: timeSlot.maxCapacity,
      dayOfWeek: timeSlot.dayOfWeek,
      coach: timeSlot.coach
        ? { id: timeSlot.coach.id, fullNameLatin: timeSlot.coach.fullNameLatin }
        : null,
    },
    roster,
    enrollment: {
      current: schedules.length,
      max: timeSlot.maxCapacity,
    },
  };
}

// ─── Mark / unmark attendance ───────────────────────────────────────────────

export async function markAttendance(
  timeSlotId: string,
  data: MarkAttendanceInput,
  operatorId: string,
) {
  const timeSlot = await prisma.timeSlot.findFirst({
    where: { id: timeSlotId, deletedAt: null },
  });
  if (!timeSlot) {
    throw new SessionsError('NOT_FOUND', 'Time slot not found', 404);
  }

  // Verify member exists
  const member = await prisma.member.findFirst({
    where: { id: data.memberId, deletedAt: null },
  });
  if (!member) {
    throw new SessionsError('NOT_FOUND', 'Member not found', 404);
  }

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );

  if (data.present) {
    // Check for duplicate — don't create if already checked in today for this discipline
    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        memberId: data.memberId,
        disciplineId: timeSlot.disciplineId,
        checkInTime: { gte: startOfDay, lte: endOfDay },
        deletedAt: null,
      },
    });
    if (existing) {
      throw new SessionsError('DUPLICATE', 'Member already checked in for this session today', 409);
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        memberId: data.memberId,
        disciplineId: timeSlot.disciplineId,
        checkInTime: now,
        method: 'manual',
        operatorId,
      },
    });

    return { record: { id: record.id, checkInTime: record.checkInTime.toISOString() } };
  } else {
    // Soft-delete today's attendance for this member + discipline
    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        memberId: data.memberId,
        disciplineId: timeSlot.disciplineId,
        checkInTime: { gte: startOfDay, lte: endOfDay },
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new SessionsError('NOT_FOUND', 'No attendance record found for today', 404);
    }

    await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { deletedAt: now },
    });

    return { removed: true };
  }
}

// ─── Check conflicts (without creating) ─────────────────────────────────────

export async function checkConflicts(data: CheckConflictsInput) {
  const conflicts = await detectConflicts({
    coachId: data.coachId ?? null,
    room: data.room ?? null,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
    excludeId: data.excludeId,
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

// ─── Enroll a member into a time slot ───────────────────────────────────────

export async function enrollMember(timeSlotId: string, data: EnrollMemberInput) {
  // Verify time slot exists
  const timeSlot = await prisma.timeSlot.findFirst({
    where: { id: timeSlotId, deletedAt: null },
    include: {
      schedules: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });
  if (!timeSlot) {
    throw new SessionsError('NOT_FOUND', 'Time slot not found', 404);
  }

  // Capacity enforcement: block at 100%
  const currentEnrollment = timeSlot.schedules.length;
  if (currentEnrollment >= timeSlot.maxCapacity) {
    throw new SessionsError('CAPACITY_FULL', 'This session is at full capacity', 409);
  }

  // Warn at 90%+
  const pct = (currentEnrollment + 1) / timeSlot.maxCapacity;
  const nearCapacity = pct >= 0.9;

  // Verify member exists
  const member = await prisma.member.findFirst({
    where: { id: data.memberId, deletedAt: null },
  });
  if (!member) {
    throw new SessionsError('NOT_FOUND', 'Member not found', 404);
  }

  // Find the active MemberDiscipline linking this member to this slot's discipline
  const memberDiscipline = await prisma.memberDiscipline.findFirst({
    where: {
      memberId: data.memberId,
      disciplineId: timeSlot.disciplineId,
      deletedAt: null,
      status: 'active',
    },
  });
  if (!memberDiscipline) {
    throw new SessionsError(
      'NOT_ENROLLED_IN_DISCIPLINE',
      'Member is not actively enrolled in the discipline for this session',
      409,
    );
  }

  // Check for duplicate enrollment in this specific time slot
  const duplicate = await prisma.schedule.findFirst({
    where: {
      memberDisciplineId: memberDiscipline.id,
      timeSlotId,
      deletedAt: null,
    },
  });
  if (duplicate) {
    throw new SessionsError('ALREADY_ENROLLED', 'Member is already enrolled in this session', 409);
  }

  const schedule = await prisma.schedule.create({
    data: {
      memberDisciplineId: memberDiscipline.id,
      timeSlotId,
      dayOfWeek: timeSlot.dayOfWeek,
    },
    include: {
      memberDiscipline: {
        include: {
          member: {
            select: {
              id: true,
              firstNameLatin: true,
              lastNameLatin: true,
              photoPath: true,
            },
          },
        },
      },
    },
  });

  return {
    schedule: {
      id: schedule.id,
      memberId: schedule.memberDiscipline.member.id,
      member: {
        id: schedule.memberDiscipline.member.id,
        firstNameLatin: schedule.memberDiscipline.member.firstNameLatin,
        lastNameLatin: schedule.memberDiscipline.member.lastNameLatin,
        photoPath: schedule.memberDiscipline.member.photoPath,
      },
    },
    enrollment: {
      current: currentEnrollment + 1,
      max: timeSlot.maxCapacity,
    },
    nearCapacity,
    warning: nearCapacity
      ? `Session is at ${Math.round(pct * 100)}% capacity (${currentEnrollment + 1}/${timeSlot.maxCapacity})`
      : null,
  };
}

// ─── Unenroll a member from a time slot ─────────────────────────────────────

export async function unenrollMember(timeSlotId: string, memberId: string): Promise<void> {
  const timeSlot = await prisma.timeSlot.findFirst({
    where: { id: timeSlotId, deletedAt: null },
  });
  if (!timeSlot) {
    throw new SessionsError('NOT_FOUND', 'Time slot not found', 404);
  }

  // Find the schedule entry via memberDiscipline
  const schedule = await prisma.schedule.findFirst({
    where: {
      timeSlotId,
      deletedAt: null,
      memberDiscipline: {
        memberId,
        deletedAt: null,
      },
    },
  });
  if (!schedule) {
    throw new SessionsError('NOT_FOUND', 'Member is not enrolled in this session', 404);
  }

  await prisma.schedule.update({
    where: { id: schedule.id },
    data: { deletedAt: new Date() },
  });
}

// ─── Get all active coaches (for session form dropdowns) ─────────────────────

export async function getSessionCoaches() {
  const coaches = await prisma.user.findMany({
    where: { role: 'coach', isActive: true, deletedAt: null },
    select: { id: true, fullNameLatin: true, fullNameArabic: true },
    orderBy: { fullNameLatin: 'asc' },
  });
  return { coaches };
}
