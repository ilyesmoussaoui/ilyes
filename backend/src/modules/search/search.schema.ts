import { z } from 'zod';

// ─── GET /search ──────────────────────────────────────────────────────────────

export const searchScopeEnum = z.enum(['all', 'members', 'payments', 'products']);
export type SearchScope = z.infer<typeof searchScopeEnum>;

export const globalSearchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Query parameter "q" is required' })
    .min(2, 'Query must be at least 2 characters')
    .max(100, 'Query must be at most 100 characters'),
  scope: searchScopeEnum.default('all'),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;

// ─── Response shapes ──────────────────────────────────────────────────────────

export const memberResultSchema = z.object({
  id: z.string().uuid(),
  firstNameLatin: z.string().nullable(),
  lastNameLatin: z.string().nullable(),
  firstNameArabic: z.string().nullable(),
  lastNameArabic: z.string().nullable(),
  photoPath: z.string().nullable(),
});

export type MemberResult = z.infer<typeof memberResultSchema>;

export const paymentResultSchema = z.object({
  id: z.string().uuid(),
  receiptNumber: z.string(),
  amount: z.number().int(),
  paidAt: z.string(), // ISO timestamp string
  memberId: z.string().uuid(),
  memberName: z.string(),
});

export type PaymentResult = z.infer<typeof paymentResultSchema>;

export const productResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  stockQuantity: z.number().int(),
  priceCents: z.number().int(),
});

export type ProductResult = z.infer<typeof productResultSchema>;

export const globalSearchResponseSchema = z.object({
  members: z.array(memberResultSchema),
  payments: z.array(paymentResultSchema),
  products: z.array(productResultSchema),
});

export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;

// ─── POST /search/face ────────────────────────────────────────────────────────

export const faceMemberSchema = z.object({
  firstNameLatin: z.string().nullable(),
  lastNameLatin: z.string().nullable(),
  photoPath: z.string().nullable(),
});

export const faceMatchResultSchema = z.object({
  memberId: z.string(),
  confidence: z.number(),
  member: faceMemberSchema,
});

export type FaceMatchResult = z.infer<typeof faceMatchResultSchema>;

export const faceSearchResponseSchema = z.object({
  matches: z.array(faceMatchResultSchema),
});

export type FaceSearchResponse = z.infer<typeof faceSearchResponseSchema>;
