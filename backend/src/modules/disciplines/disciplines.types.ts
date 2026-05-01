import { z } from 'zod';

export const disciplineIdParamSchema = z.object({
  id: z.string().uuid('Invalid discipline id'),
});

export type DisciplineIdParam = z.infer<typeof disciplineIdParamSchema>;

const scheduleInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  timeSlotId: z.string().uuid('Invalid time slot id'),
});

const enrollmentInputSchema = z.object({
  disciplineId: z.string().uuid('Invalid discipline id'),
  instructorId: z.string().uuid('Invalid instructor id').optional(),
  beltRank: z.string().trim().max(50).optional(),
  schedules: z.array(scheduleInputSchema).max(14).default([]),
});

export const createEnrollmentsSchema = z.object({
  enrollments: z.array(enrollmentInputSchema).min(1, 'At least one enrollment required').max(10),
});

export type CreateEnrollmentsInput = z.infer<typeof createEnrollmentsSchema>;

export const memberIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
});

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;
