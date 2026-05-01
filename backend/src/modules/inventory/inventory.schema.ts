import { z } from 'zod';

// ─── Shared schemas ──────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

export const memberIdParamSchema = z.object({
  memberId: z.string().uuid('Invalid member id'),
});

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;

// ─── Stock adjustment reasons ────────────────────────────────────────────────

export const stockAdjustmentReasonEnum = z.enum([
  'manual_add',
  'manual_remove',
  'correction',
  'initial_stock',
]);

export type StockAdjustmentReason = z.infer<typeof stockAdjustmentReasonEnum>;

// ─── Create equipment body ──────────────────────────────────────────────────

export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  price: z.number().int().min(0, 'Price must be non-negative'),
  stockQuantity: z.number().int().min(0, 'Stock quantity must be non-negative').default(0),
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
});

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;

// ─── Update equipment body ──────────────────────────────────────────────────

export const updateEquipmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  price: z.number().int().min(0, 'Price must be non-negative').optional(),
  disciplineId: z.string().uuid('Invalid discipline id').nullable().optional(),
});

export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;

// ─── Stock adjustment body ──────────────────────────────────────────────────

export const stockAdjustmentSchema = z.object({
  quantityChange: z.number().int().refine((v) => v !== 0, {
    message: 'Quantity change must not be zero',
  }),
  reason: stockAdjustmentReasonEnum,
  notes: z.string().trim().max(1000).optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

// ─── List equipment query ───────────────────────────────────────────────────

export const listEquipmentQuerySchema = z.object({
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
  search: z.string().trim().max(200).optional(),
  lowStock: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type ListEquipmentQuery = z.infer<typeof listEquipmentQuerySchema>;
