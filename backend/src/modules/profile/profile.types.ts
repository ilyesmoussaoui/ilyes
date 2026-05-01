import { z } from 'zod';

// ─── Param schemas ───────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

export const noteIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
  noteId: z.string().uuid('Invalid note id'),
});

export type NoteIdParam = z.infer<typeof noteIdParamSchema>;

export const familyLinkIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
  linkId: z.string().uuid('Invalid family link id'),
});

export type FamilyLinkIdParam = z.infer<typeof familyLinkIdParamSchema>;

// ─── Query schemas ────────────────────────────────────────────────────────────

export const attendanceQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  month: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(12).optional()),
  year: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(2000).max(2100).optional()),
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
});

export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export const paymentsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  type: z.enum(['full', 'partial', 'refund', 'adjustment']).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

export type PaymentsQuery = z.infer<typeof paymentsQuerySchema>;

export const auditLogQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  userId: z.string().uuid('Invalid user id').optional(),
  tableName: z.string().min(1).max(100).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

// ─── Body schemas ─────────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content cannot exceed 5000 characters'),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content cannot exceed 5000 characters'),
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const createFamilyLinkSchema = z.object({
  relatedMemberId: z.string().uuid('Invalid related member id'),
  relationship: z.string().trim().min(1, 'Relationship is required').max(100),
});

export type CreateFamilyLinkInput = z.infer<typeof createFamilyLinkSchema>;
