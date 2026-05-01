import { z } from 'zod';

const documentTypeEnum = z.enum([
  'id_card',
  'medical_certificate',
  'birth_certificate',
  'insurance',
  'parental_authorization',
  'belt_certificate',
  'photo',
  'other',
]);

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date (YYYY-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
  .optional()
  .nullable();

const documentInputSchema = z.object({
  type: documentTypeEnum,
  issueDate: isoDateString,
  expiryDate: isoDateString,
});

export const createDocumentsSchema = z.object({
  documents: z.array(documentInputSchema).min(1, 'At least one document required').max(20),
});

export type CreateDocumentsInput = z.infer<typeof createDocumentsSchema>;

export const memberIdParamSchema = z.object({
  id: z.string().uuid('Invalid member id'),
});

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;
