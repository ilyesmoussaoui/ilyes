import { z } from 'zod';

const planTypeEnum = z.enum(['monthly', 'quarterly', 'biannual', 'annual', 'session_pack']);

const subscriptionInputSchema = z.object({
  disciplineId: z.string().uuid('Invalid discipline id'),
  planType: planTypeEnum,
  amount: z.number().int().min(0).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date').optional(),
});

const equipmentInputSchema = z.object({
  equipmentId: z.string().uuid('Invalid equipment id'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(6, 'Quantity cannot exceed 6'),
});

const familyLinkInputSchema = z.object({
  relatedMemberId: z.string().uuid('Invalid related member id'),
  relationship: z.string().trim().min(1, 'Relationship is required').max(100),
});

const paymentInputSchema = z
  .object({
    paymentType: z.enum(['full', 'partial', 'later']),
    paidAmount: z.number().int().min(0).optional().default(0),
    notes: z.string().trim().max(500).optional(),
  })
  .nullable()
  .optional();

export const createBillingSchema = z.object({
  subscriptions: z.array(subscriptionInputSchema).max(10).default([]),
  equipment: z.array(equipmentInputSchema).max(20).default([]),
  familyLinks: z.array(familyLinkInputSchema).max(10).default([]),
  payment: paymentInputSchema,
});

export type CreateBillingInput = z.infer<typeof createBillingSchema>;

export const memberIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
});

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters').max(200),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
