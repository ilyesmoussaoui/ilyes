import { z } from 'zod';

// ─── Param schemas ───────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid time slot id'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

// ─── HH:mm time format ──────────────────────────────────────────────────────

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');

// ─── GET /time-slots query ──────────────────────────────────────────────────

export const timeSlotsQuerySchema = z.object({
  dayOfWeek: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(0).max(6).optional()),
});

export type TimeSlotsQuery = z.infer<typeof timeSlotsQuerySchema>;

// ─── POST /time-slots body ──────────────────────────────────────────────────

export const createTimeSlotSchema = z
  .object({
    disciplineId: z.string().uuid('Invalid discipline id'),
    coachId: z.string().uuid('Invalid coach id').optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    maxCapacity: z.number().int().min(1).max(200),
    room: z.string().trim().max(255).optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

export type CreateTimeSlotInput = z.infer<typeof createTimeSlotSchema>;

// ─── PUT /time-slots/:id body ───────────────────────────────────────────────

export const updateTimeSlotSchema = z
  .object({
    disciplineId: z.string().uuid('Invalid discipline id').optional(),
    coachId: z.string().uuid('Invalid coach id').nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    maxCapacity: z.number().int().min(1).max(200).optional(),
    room: z.string().trim().max(255).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startTime !== undefined && data.endTime !== undefined) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    {
      message: 'startTime must be before endTime',
      path: ['endTime'],
    },
  );

export type UpdateTimeSlotInput = z.infer<typeof updateTimeSlotSchema>;

// ─── POST /time-slots/:id/attendance body ───────────────────────────────────

export const markAttendanceSchema = z.object({
  memberId: z.string().uuid('Invalid member id'),
  present: z.boolean(),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

// ─── POST /check-conflicts body ─────────────────────────────────────────────

export const checkConflictsSchema = z
  .object({
    coachId: z.string().uuid('Invalid coach id').optional(),
    room: z.string().trim().max(255).optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    excludeId: z.string().uuid('Invalid exclude id').optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

export type CheckConflictsInput = z.infer<typeof checkConflictsSchema>;

// ─── POST /time-slots/:id/enroll body ───────────────────────────────────────

export const enrollMemberSchema = z.object({
  memberId: z.string().uuid('Invalid member id'),
});

export type EnrollMemberInput = z.infer<typeof enrollMemberSchema>;

// ─── DELETE /time-slots/:id/members/:memberId params ────────────────────────

export const enrollmentParamSchema = z.object({
  id: z.string().uuid('Invalid time slot id'),
  memberId: z.string().uuid('Invalid member id'),
});

export type EnrollmentParam = z.infer<typeof enrollmentParamSchema>;
