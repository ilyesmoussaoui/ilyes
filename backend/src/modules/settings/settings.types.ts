import { z } from 'zod';

// ─── System settings ────────────────────────────────────────────────────────

export const VALID_SETTING_KEYS = [
  'club_name',
  'club_logo',
  'club_phone',
  'club_email',
  'club_address',
  'club_city',
  'club_currency',
  'receipt_header',
  'receipt_footer',
  'registrationFee',
  'licenseFee',
  'extraSessionPrice',
] as const;

// Fee keys that must be non-negative integers (centimes), max 100 000 DZD = 10_000_000 centimes
export const FEE_SETTING_KEYS = ['registrationFee', 'licenseFee', 'extraSessionPrice'] as const;
export type FeeSettingKey = (typeof FEE_SETTING_KEYS)[number];

// club_logo is stored as a base64 data URL; a 2 MB image ≈ 2.8 MB of base64 chars.
// Cap at ~5 MB to accommodate reasonable logos without blowing up the settings table.
const CLUB_LOGO_MAX_BYTES = 5_000_000;
const TEXT_VALUE_MAX = 5000;

export const bulkUpdateSettingsSchema = z.object({
  settings: z.record(
    z.enum(VALID_SETTING_KEYS),
    z.string(),
  ),
}).superRefine((data, ctx) => {
  for (const [key, raw] of Object.entries(data.settings)) {
    if (raw === undefined) continue;

    const maxLen = key === 'club_logo' ? CLUB_LOGO_MAX_BYTES : TEXT_VALUE_MAX;
    if (raw.length > maxLen) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        type: 'string',
        maximum: maxLen,
        inclusive: true,
        path: ['settings', key],
        message:
          key === 'club_logo'
            ? 'Logo is too large — please upload an image under 2 MB.'
            : `${key} must be at most ${maxLen} characters`,
      });
    }
  }

  for (const key of FEE_SETTING_KEYS) {
    const raw = data.settings[key];
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['settings', key],
        message: `${key} must be a non-negative integer up to 10 000 000 centimes`,
      });
    }
  }
});

export type BulkUpdateSettingsInput = z.infer<typeof bulkUpdateSettingsSchema>;

// ─── Fee settings ────────────────────────────────────────────────────────────

const feeAmountSchema = z.number().int().min(0).max(10_000_000);

export const updateFeeSettingsSchema = z.object({
  registrationFee: feeAmountSchema.optional(),
  licenseFee: feeAmountSchema.optional(),
  extraSessionPrice: feeAmountSchema.optional(),
}).refine(
  (data) => data.registrationFee !== undefined || data.licenseFee !== undefined || data.extraSessionPrice !== undefined,
  { message: 'At least one fee must be provided' },
);

export type UpdateFeeSettingsInput = z.infer<typeof updateFeeSettingsSchema>;

// ─── User management ────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const createUserSchema = z.object({
  email: z.string().email('Invalid email').max(254),
  password: passwordSchema,
  fullNameLatin: z.string().min(1, 'Full name is required').max(200),
  fullNameArabic: z.string().max(200).optional().nullable(),
  roleId: z.string().uuid('Invalid role ID'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullNameLatin: z.string().min(1).max(200).optional(),
  fullNameArabic: z.string().max(200).optional().nullable(),
  email: z.string().email('Invalid email').max(254).optional(),
  roleId: z.string().uuid('Invalid role ID').optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ─── Role management ────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100).regex(/^[a-z][a-z0-9_ ]*$/i, 'Role name must start with a letter and contain only letters, numbers, spaces, or underscores'),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(z.string().regex(/^[a-z_]+:[a-z_]+$/, 'Permission must be in "resource:action" format')).min(1, 'At least one permission is required'),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_ ]*$/i, 'Role name must start with a letter and contain only letters, numbers, spaces, or underscores').optional(),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(z.string().regex(/^[a-z_]+:[a-z_]+$/, 'Permission must be in "resource:action" format')).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ─── Discipline settings ────────────────────────────────────────────────────

export const createDisciplineSchema = z.object({
  name: z.string().min(1, 'Discipline name is required').max(200),
});

export type CreateDisciplineInput = z.infer<typeof createDisciplineSchema>;

export const updateDisciplineSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateDisciplineInput = z.infer<typeof updateDisciplineSchema>;

// ─── Pricing settings ───────────────────────────────────────────────────────

export const createPricingSchema = z.object({
  disciplineId: z.string().uuid('Invalid discipline ID'),
  planType: z.enum(['monthly', 'quarterly', 'biannual', 'annual', 'session_pack']),
  amount: z.number().int().min(0, 'Amount must be non-negative'),
});

export type CreatePricingInput = z.infer<typeof createPricingSchema>;

export const updatePricingSchema = z.object({
  amount: z.number().int().min(0, 'Amount must be non-negative').optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;

// ─── Document settings ──────────────────────────────────────────────────────

const documentRequirementItemSchema = z.object({
  documentType: z.enum([
    'id_card',
    'medical_certificate',
    'photo',
    'birth_certificate',
    'insurance',
    'parental_authorization',
    'belt_certificate',
    'other',
  ]),
  isRequired: z.boolean(),
  memberTypes: z.array(z.enum(['athlete', 'staff', 'external'])),
  validityMonths: z.number().int().min(1).max(120).optional().nullable(),
});

export const bulkUpdateDocumentRequirementsSchema = z.object({
  requirements: z.array(documentRequirementItemSchema),
});

export type BulkUpdateDocumentRequirementsInput = z.infer<typeof bulkUpdateDocumentRequirementsSchema>;

// ─── Notification settings ──────────────────────────────────────────────────

const notificationSettingItemSchema = z.object({
  type: z.enum([
    'subscription_expiring',
    'payment_due',
    'document_expiring',
    'birthday',
    'general',
  ]),
  isEnabled: z.boolean(),
  daysBefore: z.number().int().min(0).max(365).optional().nullable(),
  template: z.string().max(5000).optional().nullable(),
});

export const bulkUpdateNotificationSettingsSchema = z.object({
  settings: z.array(notificationSettingItemSchema),
});

export type BulkUpdateNotificationSettingsInput = z.infer<typeof bulkUpdateNotificationSettingsSchema>;

// ─── Common ─────────────────────────────────────────────────────────────────

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});
