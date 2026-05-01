import { z } from 'zod';

// ─── Shared schemas ──────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

// ─── Payment item types ──────────────────────────────────────────────────────

const paymentItemTypeEnum = z.enum([
  'subscription',
  'equipment',
  'fee',
  'registration',
  'other',
]);

// ─── Create payment body ─────────────────────────────────────────────────────

const paymentItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  amount: z.number().int().min(0, 'Amount must be non-negative'),
  type: paymentItemTypeEnum,
});

export const createPaymentSchema = z
  .object({
    memberId: z.string().uuid('Invalid member id'),
    items: z
      .array(paymentItemSchema)
      .min(1, 'At least one item is required')
      .max(50),
    paymentType: z.enum(['full', 'partial', 'later']),
    paidAmount: z.number().int().min(0, 'Paid amount must be non-negative'),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => {
      const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
      return data.paidAmount <= totalAmount;
    },
    { message: 'Paid amount cannot exceed total amount', path: ['paidAmount'] },
  )
  .refine(
    (data) => data.paymentType !== 'later' || data.paidAmount === 0,
    { message: 'Pay-later records must have paidAmount=0', path: ['paidAmount'] },
  );

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ─── List payments query ─────────────────────────────────────────────────────

export const listPaymentsQuerySchema = z.object({
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
  memberId: z.string().uuid('Invalid member id').optional(),
  paymentType: z.enum(['full', 'partial', 'later', 'refund', 'adjustment']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z
    .enum(['createdAt', 'totalAmount', 'receiptNumber'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

// ─── Refund body ─────────────────────────────────────────────────────────────

export const createRefundSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(1000),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;

// ─── Collect payment (apply to outstanding balance) ──────────────────────────

export const collectPaymentSchema = z.object({
  amount: z.number().int().min(1, 'Amount must be at least 1 centime'),
  notes: z.string().trim().max(1000).optional(),
});

export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;

export const memberIdParamSchema = z.object({
  memberId: z.string().uuid('Invalid member id'),
});

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;

// ─── POS checkout body ───────────────────────────────────────────────────────

const posItemSchema = z
  .object({
    description: z.string().trim().min(1, 'Description is required').max(500),
    // Accept either `amount` (legacy) or `unitPrice` (preferred) as the per-unit price.
    amount: z.number().int().min(0).optional(),
    unitPrice: z.number().int().min(0).optional(),
    type: paymentItemTypeEnum.optional().default('equipment'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100),
    productId: z.string().uuid('Invalid product id').optional(),
  })
  .transform((item) => ({
    description: item.description,
    // Resolve amount: prefer explicit `amount`, fall back to `unitPrice`, default 0
    amount: item.amount ?? item.unitPrice ?? 0,
    type: item.type,
    quantity: item.quantity,
    productId: item.productId,
  }));

export const posCheckoutSchema = z
  .object({
    memberId: z.string().uuid('Invalid member id').optional(),
    items: z
      .array(posItemSchema)
      .min(1, 'At least one item is required')
      .max(50),
    paymentType: z.enum(['full', 'partial', 'later']),
    paidAmount: z.number().int().min(0, 'Paid amount must be non-negative'),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => {
      const totalAmount = data.items.reduce(
        (sum, item) => sum + item.amount * item.quantity,
        0,
      );
      return data.paidAmount <= totalAmount;
    },
    { message: 'Paid amount cannot exceed total amount', path: ['paidAmount'] },
  )
  .refine(
    (data) => data.paymentType !== 'later' || data.paidAmount === 0,
    { message: 'Pay-later records must have paidAmount=0', path: ['paidAmount'] },
  );

export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>;
