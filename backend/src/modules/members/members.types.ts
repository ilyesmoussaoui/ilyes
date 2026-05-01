import { z } from 'zod';

const memberTypeEnum = z.enum(['athlete', 'staff', 'external']);
const genderEnum = z.enum(['male', 'female']);
const contactTypeEnum = z.enum(['phone', 'email', 'address']);

const nullableString = (max = 200) =>
  z.string().trim().max(max).optional().nullable();

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date (YYYY-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
  .optional()
  .nullable();

export const createMemberSchema = z.object({
  type: memberTypeEnum,
  firstNameLatin: nullableString(100),
  lastNameLatin: nullableString(100),
  firstNameArabic: nullableString(100),
  lastNameArabic: nullableString(100),
  gender: genderEnum.optional().nullable(),
  dateOfBirth: isoDateString,
  placeOfBirth: nullableString(150),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const contactInputSchema = z.object({
  type: contactTypeEnum,
  value: z.string().trim().min(1, 'Contact value required').max(300),
  isPrimary: z.boolean().optional().default(false),
});

export const emergencyContactInputSchema = z.object({
  name: z.string().trim().min(1, 'Name required').max(150),
  phone: z.string().trim().min(1, 'Phone required').max(50),
  relationship: z.string().trim().min(1, 'Relationship required').max(100),
});

export const updateMemberSchema = z.object({
  firstNameLatin: nullableString(100),
  lastNameLatin: nullableString(100),
  firstNameArabic: nullableString(100),
  lastNameArabic: nullableString(100),
  gender: genderEnum.optional().nullable(),
  dateOfBirth: isoDateString,
  placeOfBirth: nullableString(150),
  contacts: z.array(contactInputSchema).max(20).optional(),
  emergencyContacts: z.array(emergencyContactInputSchema).max(10).optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
});

export const checkDuplicateQuerySchema = z.object({
  firstName: z.string().trim().max(100).optional().default(''),
  lastName: z.string().trim().max(100).optional().default(''),
  lang: z.enum(['latin', 'arabic']).optional().default('latin'),
});

export type CheckDuplicateQuery = z.infer<typeof checkDuplicateQuerySchema>;

export const photoFileParamsSchema = z.object({
  memberId: z.string().uuid('Invalid member id'),
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9._-]+$/, 'Invalid filename'),
});

export type PhotoFileParams = z.infer<typeof photoFileParamsSchema>;

export const memberScopeEnum = z.enum([
  'unpaid',
  'renewal',
  'expiring',
  'docs',
  'inactive',
  'absent',
]);

export type MemberScope = z.infer<typeof memberScopeEnum>;

export const listMembersQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
  type: z.enum(['athlete', 'staff', 'external']).optional(),
  status: z.enum(['pending', 'active', 'suspended', 'inactive']).optional(),
  scope: memberScopeEnum.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).transform((data) => ({
  ...data,
  pageSize: data.pageSize ?? data.limit ?? 20,
}));

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
