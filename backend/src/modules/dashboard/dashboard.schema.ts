import { z } from 'zod';

// ─── Query params ─────────────────────────────────────────────────────────────

export const alertsQuerySchema = z.object({
  expiringWindowDays: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 14))
    .pipe(z.number().int().min(1).max(90)),

  inactiveThresholdDays: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 30))
    .pipe(z.number().int().min(1).max(365)),

  limitPerCategory: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export type AlertsQuery = z.infer<typeof alertsQuerySchema>;

// ─── Response shapes ──────────────────────────────────────────────────────────

export const alertMemberSchema = z.object({
  memberId: z.string().uuid(),
  firstNameLatin: z.string(),
  lastNameLatin: z.string(),
  firstNameArabic: z.string().nullable(),
  lastNameArabic: z.string().nullable(),
  photoPath: z.string().nullable(),
  discipline: z.string().nullable(),
  renewalDate: z.string().nullable(), // ISO date string
  extra: z
    .object({
      balanceDue: z.number().optional(),
      daysInactive: z.number().optional(),
      missingDocTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

export type AlertMember = z.infer<typeof alertMemberSchema>;

export const alertStockItemSchema = z.object({
  equipmentId: z.string().uuid(),
  name: z.string(),
  stockQuantity: z.number().int(),
});

export type AlertStockItem = z.infer<typeof alertStockItemSchema>;

export const alertsResponseSchema = z.object({
  subscriptionsExpiring: z.array(alertMemberSchema),
  unpaidBalance: z.array(alertMemberSchema),
  renewalNeeded: z.array(alertMemberSchema),
  missingDocuments: z.array(alertMemberSchema),
  inactiveMembers: z.array(alertMemberSchema),
  absentToday: z.array(alertMemberSchema),
  stockOut: z.array(alertStockItemSchema),
});

export type AlertsResponse = z.infer<typeof alertsResponseSchema>;
