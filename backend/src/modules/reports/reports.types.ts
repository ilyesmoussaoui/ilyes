import { z } from 'zod';

// ─── Shared schemas ──────────────────────────────────────────────────────────

const dateStringSchema = z
  .string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date format' });

export const dateRangeSchema = z.object({
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

const groupByEnum = z.enum(['day', 'week', 'month']);

// ─── Attendance report query ─────────────────────────────────────────────────

export const attendanceReportQuerySchema = dateRangeSchema.extend({
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
  groupBy: groupByEnum.optional().default('day'),
});

export type AttendanceReportQuery = z.infer<typeof attendanceReportQuerySchema>;

// ─── Financial report query ──────────────────────────────────────────────────

export const financialReportQuerySchema = dateRangeSchema.extend({
  groupBy: groupByEnum.optional().default('month'),
  paymentType: z.enum(['full', 'partial', 'refund', 'adjustment']).optional(),
});

export type FinancialReportQuery = z.infer<typeof financialReportQuerySchema>;

// ─── Membership report query ─────────────────────────────────────────────────

export const membershipReportQuerySchema = dateRangeSchema.extend({});

export type MembershipReportQuery = z.infer<typeof membershipReportQuerySchema>;

// ─── Inventory report query ──────────────────────────────────────────────────

export const inventoryReportQuerySchema = dateRangeSchema.extend({
  equipmentId: z.string().uuid('Invalid equipment id').optional(),
});

export type InventoryReportQuery = z.infer<typeof inventoryReportQuerySchema>;

// ─── Document report query ───────────────────────────────────────────────────

export const documentReportQuerySchema = dateRangeSchema.extend({
  documentType: z
    .enum([
      'id_card',
      'medical_certificate',
      'photo',
      'birth_certificate',
      'insurance',
      'parental_authorization',
      'belt_certificate',
      'other',
    ])
    .optional(),
  status: z.enum(['valid', 'expired', 'pending', 'rejected']).optional(),
});

export type DocumentReportQuery = z.infer<typeof documentReportQuerySchema>;

// ─── Custom report query ─────────────────────────────────────────────────────

const metricEnum = z.enum([
  'attendance_count',
  'revenue',
  'new_members',
  'active_subscriptions',
  'expenses',
]);

const chartTypeEnum = z.enum([
  'bar',
  'line',
  'pie',
  'donut',
  'heatmap',
  'horizontalBar',
  'multiSeries',
  'funnel',
  'calendar',
  'scatter',
]);

export const customReportQuerySchema = z.object({
  metrics: z.array(metricEnum).min(1, 'At least one metric is required').max(5),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
  memberType: z.enum(['athlete', 'staff', 'external']).optional(),
  status: z
    .enum(['active', 'inactive', 'suspended', 'expired', 'pending'])
    .optional(),
  groupBy: groupByEnum.optional().default('month'),
  chartType: chartTypeEnum.optional().default('bar'),
});

export type CustomReportQuery = z.infer<typeof customReportQuerySchema>;

// ─── Export query ────────────────────────────────────────────────────────────

export const exportQuerySchema = dateRangeSchema.extend({
  reportType: z.enum([
    'attendance',
    'financial',
    'membership',
    'inventory',
    'documents',
  ]),
  format: z.enum(['excel', 'pdf']).optional().default('excel'),
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
  equipmentId: z.string().uuid('Invalid equipment id').optional(),
  documentType: z
    .enum([
      'id_card',
      'medical_certificate',
      'photo',
      'birth_certificate',
      'insurance',
      'parental_authorization',
      'belt_certificate',
      'other',
    ])
    .optional(),
  documentStatus: z
    .enum(['valid', 'expired', 'pending', 'rejected'])
    .optional(),
  paymentType: z.enum(['full', 'partial', 'refund', 'adjustment']).optional(),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;

// ─── Outstanding balances query ──────────────────────────────────────────────

export const outstandingBalancesQuerySchema = z.object({
  minAmount: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['remaining', 'lastPayment', 'memberName']).optional().default('remaining'),
});

export type OutstandingBalancesQuery = z.infer<typeof outstandingBalancesQuerySchema>;

// ─── Daily cash report query ─────────────────────────────────────────────────

export const dailyCashQuerySchema = z.object({
  date: dateStringSchema.optional(),
});

export type DailyCashQuery = z.infer<typeof dailyCashQuerySchema>;

// ─── Missing documents query ─────────────────────────────────────────────────

export const missingDocumentsQuerySchema = z.object({
  requiredTypes: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
});

export type MissingDocumentsQuery = z.infer<typeof missingDocumentsQuerySchema>;

// ─── Absences query ──────────────────────────────────────────────────────────

export const absencesQuerySchema = z.object({
  daysWithoutCheckIn: z.coerce.number().int().min(1).max(365).optional().default(14),
});

export type AbsencesQuery = z.infer<typeof absencesQuerySchema>;

// ─── Late arrivals query ─────────────────────────────────────────────────────

export const lateArrivalsQuerySchema = dateRangeSchema.extend({
  gracePeriodMinutes: z.coerce.number().int().min(0).max(120).optional().default(10),
  disciplineId: z.string().uuid('Invalid discipline id').optional(),
});

export type LateArrivalsQuery = z.infer<typeof lateArrivalsQuerySchema>;

// ─── Save template body ─────────────────────────────────────────────────────

export const saveTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  config: z.object({
    metrics: z.array(metricEnum).min(1).max(5),
    dateFrom: dateStringSchema.optional(),
    dateTo: dateStringSchema.optional(),
    disciplineId: z.string().uuid().optional(),
    memberType: z.enum(['athlete', 'staff', 'external']).optional(),
    status: z
      .enum(['active', 'inactive', 'suspended', 'expired', 'pending'])
      .optional(),
    groupBy: groupByEnum.optional(),
    chartType: chartTypeEnum.optional(),
  }),
});

export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;
