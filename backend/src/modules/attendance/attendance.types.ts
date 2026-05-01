import { z } from 'zod';

// ─── Param schemas ───────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid attendance record id'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

// ─── Member-ID param (for /check-in-state/:memberId) ────────────────────────

export const memberIdParamSchema = z.object({
  memberId: z.string().uuid('Invalid member id'),
});

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;

// ─── Check-in gate codes ─────────────────────────────────────────────────────

export type CheckInBlockCode =
  | 'SUBSCRIPTION_EXPIRED'
  | 'UNPAID_BALANCE'
  | 'DUPLICATE_CHECKIN';

export type CheckInWarnCode = 'EXPIRING_SOON';

// ─── Check-in state ──────────────────────────────────────────────────────────

export type CheckInState = {
  canCheckIn: boolean;
  blockingReason: CheckInBlockCode | null;
  warnings: CheckInWarnCode[];
  // populated when blockingReason === 'UNPAID_BALANCE'
  balance: number | null;
  // populated for SUBSCRIPTION_EXPIRED / EXPIRING_SOON
  expiryDate: string | null;
  // populated for EXPIRING_SOON
  daysRemaining: number | null;
  // populated when blockingReason === 'DUPLICATE_CHECKIN'
  alreadyCheckedIn: boolean;
  lastCheckInTime: string | null;
  // populated for DUPLICATE_CHECKIN
  recordId: string | null;
};

// ─── Check-in body ───────────────────────────────────────────────────────────

export const checkInSchema = z.object({
  memberId: z.string().uuid('Invalid member id'),
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
  method: z.enum(['face', 'manual', 'barcode'], {
    required_error: 'Method is required',
    invalid_type_error: 'Method must be face, manual, or barcode',
  }),
  device: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

// ─── Update (PATCH) body ─────────────────────────────────────────────────────

export const updateAttendanceSchema = z.object({
  checkInTime: z.string().datetime({ offset: true }).optional(),
  checkOutTime: z.string().datetime({ offset: true }).nullable().optional(),
  disciplineId: z.string().uuid('Invalid discipline id').nullable().optional(),
  method: z.enum(['face', 'manual', 'barcode']).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

// ─── Delete body ─────────────────────────────────────────────────────────────

export const deleteAttendanceSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type DeleteAttendanceInput = z.infer<typeof deleteAttendanceSchema>;

// ─── Logs query ──────────────────────────────────────────────────────────────

export const logsQuerySchema = z.object({
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
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  memberId: z.string().uuid('Invalid member id').optional(),
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
  method: z.enum(['face', 'manual', 'barcode']).optional(),
  device: z.string().trim().max(255).optional(),
  status: z.enum(['present', 'left', 'all']).optional().default('all'),
  search: z.string().trim().max(100).optional(),
});

export type LogsQuery = z.infer<typeof logsQuerySchema>;
