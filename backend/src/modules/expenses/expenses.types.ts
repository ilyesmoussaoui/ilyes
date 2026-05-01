import { z } from 'zod';

// ─── Shared schemas ──────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

// ─── Create expense body ─────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  date: z.string().refine(
    (v) => !isNaN(Date.parse(v)),
    { message: 'Invalid date format' },
  ),
  category: z.string().trim().min(1, 'Category is required').max(100),
  amount: z.number().int().min(1, 'Amount must be positive'),
  description: z.string().trim().max(1000).optional(),
  receiptPath: z.string().trim().max(500).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ─── Update expense body ─────────────────────────────────────────────────────

export const updateExpenseSchema = z.object({
  date: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date format' })
    .optional(),
  category: z.string().trim().min(1).max(100).optional(),
  amount: z.number().int().min(1, 'Amount must be positive').optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  receiptPath: z.string().trim().max(500).nullable().optional(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// ─── List expenses query ─────────────────────────────────────────────────────

export const listExpensesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(5000)),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.string().trim().max(100).optional(),
  sortBy: z.enum(['date', 'amount', 'category']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

// ─── Summary query ───────────────────────────────────────────────────────────

export const summaryQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

// ─── Receipt filename param ──────────────────────────────────────────────────

export const receiptFileParamSchema = z.object({
  filename: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename')
    .max(200),
});

export type ReceiptFileParam = z.infer<typeof receiptFileParamSchema>;
