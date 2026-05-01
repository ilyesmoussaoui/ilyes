import { z } from 'zod';

// ─── Path parameter schemas ───────────────────────────────────────────────────

export const memberIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
});

export const enrollmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
  enrollmentId: z.string().uuid('Invalid enrollment id'),
});

export const documentIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
  documentId: z.string().uuid('Invalid document id'),
});

export const subscriptionIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
  subscriptionId: z.string().uuid('Invalid subscription id'),
});

// ─── ISO date helper ──────────────────────────────────────────────────────────

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date (YYYY-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
  .nullable();

// ─── Enrollment schemas ───────────────────────────────────────────────────────

const scheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  timeSlotId: z.string().uuid('Invalid time slot id'),
});

export const updateEnrollmentSchema = z.object({
  beltRank: z.string().trim().max(100).nullable().optional(),
  instructorId: z.string().uuid('Invalid instructor id').nullable().optional(),
  schedules: z.array(scheduleItemSchema).max(14).optional(),
});

export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;

const planTypeEnum = z.enum(['monthly', 'quarterly', 'biannual', 'annual', 'session_pack']);

const addEnrollmentPaymentSchema = z.object({
  paymentType: z.enum(['full', 'partial', 'later']),
  paidAmount: z.number().int().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
});

const addEnrollmentBillingSchema = z.object({
  planType: planTypeEnum,
  amount: z.number().int().min(0),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date (YYYY-MM-DD)')
    .optional(),
  payment: addEnrollmentPaymentSchema,
});

export const addEnrollmentSchema = z
  .object({
    disciplineId: z.string().uuid('Invalid discipline id'),
    instructorId: z.string().uuid('Invalid instructor id').nullable().optional(),
    beltRank: z.string().trim().max(100).nullable().optional(),
    schedules: z.array(scheduleItemSchema).max(14).default([]),
    billing: addEnrollmentBillingSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.billing) return;
    const { payment, amount } = data.billing;
    if (payment.paymentType === 'partial') {
      if (payment.paidAmount === undefined || payment.paidAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['billing', 'payment', 'paidAmount'],
          message: 'Partial payment must be greater than 0',
        });
      } else if (payment.paidAmount > amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['billing', 'payment', 'paidAmount'],
          message: 'Partial payment cannot exceed total amount',
        });
      }
    }
  });

export type AddEnrollmentInput = z.infer<typeof addEnrollmentSchema>;

// ─── Document schemas ─────────────────────────────────────────────────────────

export const updateDocumentSchema = z.object({
  issueDate: isoDateString.optional(),
  expiryDate: isoDateString.optional(),
  status: z.enum(['valid', 'expired', 'pending']).optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const addDocumentSchema = z.object({
  type: z.string().trim().min(1).max(100),
  issueDate: isoDateString.optional(),
  expiryDate: isoDateString.optional(),
});

export type AddDocumentInput = z.infer<typeof addDocumentSchema>;

// ─── Subscription schemas ─────────────────────────────────────────────────────

export const updateSubscriptionSchema = z.object({
  planType: z.string().trim().min(1).max(50).optional(),
  autoRenew: z.boolean().optional(),
  status: z.enum(['active', 'expired', 'cancelled']).optional(),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const renewSubscriptionSchema = z.object({
  planType: z.string().trim().min(1).max(50),
  amount: z.number().int().min(0),
});

export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
