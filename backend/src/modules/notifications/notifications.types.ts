import { z } from 'zod';

// ─── Shared schemas ──────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

// ─── List notifications query ────────────────────────────────────────────────

export const listNotificationsQuerySchema = z.object({
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
  type: z
    .enum([
      'subscription_expiring',
      'payment_due',
      'document_expiring',
      'birthday',
      'general',
    ])
    .optional(),
  isRead: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      return undefined;
    }),
  memberId: z.string().uuid('Invalid member id').optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

// ─── Unread count response ────────────────────────────────────────────────────

export const unreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;
