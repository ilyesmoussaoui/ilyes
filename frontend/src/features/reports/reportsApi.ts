import { api } from '../../lib/api';

/* ──────────────────── Shared Filter Params ──────────────────── */

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  disciplineId?: string;
  groupBy?: 'day' | 'week' | 'month';
}

function toQueryString(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') qs.set(key, val);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/* ──────────────────── Attendance Report ──────────────────── */

export interface AttendanceSummary {
  totalCheckIns: number;
  uniqueMembers: number;
  avgDailyCheckIns: number;
  peakHour: number;
  topDiscipline: string;
}

export interface AttendanceReportData {
  summary: AttendanceSummary;
  timeSeries: { date: string; count: number }[];
  byDiscipline: { name: string; count: number }[];
  byMethod: { method: string; count: number }[];
  byHour: { hour: number; count: number }[];
  byDayHour: { dayOfWeek: number; hour: number; count: number }[];
  lastUpdated: string;
}

export function getAttendanceReport(params: ReportFilters): Promise<AttendanceReportData> {
  const qs = toQueryString({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    disciplineId: params.disciplineId,
    groupBy: params.groupBy,
  });
  return api.get<AttendanceReportData>(`/reports/attendance${qs}`);
}

/* ──────────────────── Financial Report ──────────────────── */

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  avgTransactionValue: number;
  totalRefunds: number;
}

export interface FinancialReportData {
  summary: FinancialSummary;
  revenueTimeSeries: { date: string; revenue: number; expenses: number }[];
  byPaymentType: { type: string; amount: number; count: number }[];
  byCategory: { category: string; amount: number }[];
  topMembers: { memberId: string; name: string; totalPaid: number }[];
  lastUpdated: string;
}

export function getFinancialReport(params: ReportFilters): Promise<FinancialReportData> {
  const qs = toQueryString({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    groupBy: params.groupBy,
  });
  return api.get<FinancialReportData>(`/reports/financial${qs}`);
}

/* ──────────────────── Membership Report ──────────────────── */

export interface MembershipSummary {
  totalMembers: number;
  activeMembers: number;
  newMembersInRange: number;
  expiringSubscriptions: number;
  activeRatio: number;
}

export interface MembershipReportData {
  summary: MembershipSummary;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  byGender: { gender: string; count: number }[];
  byAge: { bucket: string; count: number }[];
  growthTimeSeries: { date: string; newMembers: number; totalActive: number }[];
  subscriptionsByPlan: { planType: string; count: number; revenue: number }[];
  lastUpdated: string;
}

export function getMembershipReport(params: ReportFilters): Promise<MembershipReportData> {
  const qs = toQueryString({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  return api.get<MembershipReportData>(`/reports/membership${qs}`);
}

/* ──────────────────── Inventory Report ──────────────────── */

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  totalStockValue: number;
  totalSalesValue: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  price: number;
  totalSold: number;
  revenue: number;
}

export interface StockMovement {
  date: string;
  item: string;
  quantityChange: number;
  reason: string;
}

export interface InventoryReportData {
  summary: InventorySummary;
  items: InventoryItem[];
  stockMovements: StockMovement[];
  lastUpdated: string;
}

export function getInventoryReport(params: ReportFilters): Promise<InventoryReportData> {
  const qs = toQueryString({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  return api.get<InventoryReportData>(`/reports/inventory${qs}`);
}

/* ──────────────────── Document Report ──────────────────── */

export interface DocumentSummary {
  totalDocuments: number;
  expiredCount: number;
  expiringCount: number;
  complianceRate: number;
}

export interface DocumentTypeBreakdown {
  type: string;
  total: number;
  valid: number;
  expired: number;
  pending: number;
}

export interface ExpiringDocument {
  memberId: string;
  memberName: string;
  documentType: string;
  expiryDate: string | null;
}

export interface DocumentReportData {
  summary: DocumentSummary;
  byType: DocumentTypeBreakdown[];
  byStatus: { status: string; count: number }[];
  expiringDocuments: ExpiringDocument[];
  lastUpdated: string;
}

export function getDocumentReport(params: ReportFilters): Promise<DocumentReportData> {
  const qs = toQueryString({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  return api.get<DocumentReportData>(`/reports/documents${qs}`);
}

/* ──────────────────── Custom Report ──────────────────── */

export interface CustomReportParams {
  metrics: string[];
  dateFrom?: string;
  dateTo?: string;
  disciplineId?: string;
  memberType?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface CustomReportSeries {
  metric: string;
  data: { label: string; value: number }[];
}

export interface CustomReportData {
  series: CustomReportSeries[];
  lastUpdated: string;
}

export function getCustomReport(params: CustomReportParams): Promise<CustomReportData> {
  return api.post<CustomReportData>('/reports/custom', params);
}

/* ──────────────────── Templates ──────────────────── */

export interface ReportTemplate {
  id: string;
  name: string;
  config: CustomReportParams;
  chartType: string;
  createdAt: string;
}

export function getTemplates(): Promise<ReportTemplate[]> {
  return api.get<ReportTemplate[]>('/reports/templates');
}

export function saveTemplate(body: { name: string; config: CustomReportParams & { chartType?: string } }): Promise<ReportTemplate> {
  return api.post<ReportTemplate>('/reports/templates', body);
}

export function deleteTemplate(id: string): Promise<void> {
  return api.delete<void>(`/reports/templates/${id}`);
}

/* ──────────────────── Outstanding Balances ──────────────────── */

export interface OutstandingBalanceMember {
  memberId: string;
  memberName: string;
  phone: string | null;
  totalOutstanding: number;
  paymentCount: number;
  lastPaymentAt: string | null;
  oldestUnpaidAt: string | null;
  ageDays: number;
  ageBucket: '0_30' | '31_60' | '61_90' | '90_plus';
}

export interface OutstandingBalancesData {
  summary: {
    totalOutstanding: number;
    memberCount: number;
    avgOutstanding: number;
  };
  members: OutstandingBalanceMember[];
  byAgeBucket: { bucket: string; count: number; total: number }[];
  lastUpdated: string;
}

export function getOutstandingBalances(params?: {
  minAmount?: number;
  sortBy?: 'remaining' | 'lastPayment' | 'memberName';
}): Promise<OutstandingBalancesData> {
  const qs = toQueryString({
    minAmount: params?.minAmount !== undefined ? String(params.minAmount) : undefined,
    sortBy: params?.sortBy,
  });
  return api.get<OutstandingBalancesData>(`/reports/outstanding-balances${qs}`);
}

/* ──────────────────── Daily Cash Report ──────────────────── */

export interface DailyCashTransaction {
  id: string;
  time: string;
  type: 'revenue' | 'refund' | 'expense';
  label: string;
  memberName: string | null;
  amount: number;
  category: string;
}

export interface DailyCashData {
  date: string;
  summary: {
    totalRevenue: number;
    totalRefunds: number;
    totalExpenses: number;
    netCash: number;
    transactionCount: number;
  };
  byPaymentType: { type: string; amount: number; count: number }[];
  expensesByCategory: { category: string; amount: number; count: number }[];
  hourly: {
    hour: number;
    revenue: number;
    refunds: number;
    expenses: number;
    net: number;
  }[];
  transactions: DailyCashTransaction[];
  lastUpdated: string;
}

export function getDailyCashReport(params?: { date?: string }): Promise<DailyCashData> {
  const qs = toQueryString({ date: params?.date });
  return api.get<DailyCashData>(`/reports/daily-cash${qs}`);
}

/* ──────────────────── Missing Documents ──────────────────── */

export interface MissingDocumentsMember {
  memberId: string;
  memberName: string;
  phone: string | null;
  type: string;
  status: string;
  createdAt: string;
  missingTypes: string[];
  missingCount: number;
}

export interface MissingDocumentsData {
  summary: {
    totalMembers: number;
    membersWithMissing: number;
    compliancePct: number;
    requiredTypes: string[];
  };
  members: MissingDocumentsMember[];
  byType: { type: string; missingCount: number }[];
  lastUpdated: string;
}

export function getMissingDocuments(params?: {
  requiredTypes?: string[];
}): Promise<MissingDocumentsData> {
  const qs = toQueryString({
    requiredTypes: params?.requiredTypes?.join(','),
  });
  return api.get<MissingDocumentsData>(`/reports/missing-documents${qs}`);
}

/* ──────────────────── Absences ──────────────────── */

export interface AbsentMember {
  memberId: string;
  memberName: string;
  phone: string | null;
  type: string;
  lastCheckIn: string | null;
  daysSinceLastCheckIn: number | null;
  neverCheckedIn: boolean;
}

export interface AbsencesData {
  summary: {
    inactiveMemberCount: number;
    daysWithoutCheckIn: number;
    cutoffDate: string;
  };
  members: AbsentMember[];
  byBucket: { bucket: string; count: number }[];
  lastUpdated: string;
}

export function getAbsences(params?: {
  daysWithoutCheckIn?: number;
}): Promise<AbsencesData> {
  const qs = toQueryString({
    daysWithoutCheckIn:
      params?.daysWithoutCheckIn !== undefined ? String(params.daysWithoutCheckIn) : undefined,
  });
  return api.get<AbsencesData>(`/reports/absences${qs}`);
}

/* ──────────────────── Late Arrivals ──────────────────── */

export type LateArrivalBucket = '0_15' | '16_30' | '31_60' | '60_plus';

export interface LateArrivalRecord {
  id: string;
  memberId: string;
  memberName: string;
  discipline: string | null;
  checkInTime: string;
  scheduledStartTime: string;
  minutesLate: number;
}

export interface LateArrivalsData {
  summary: {
    totalLateArrivals: number;
    uniqueMembersLate: number;
    gracePeriodMinutes: number;
    avgMinutesLate: number;
  };
  records: LateArrivalRecord[];
  topLateMembers: {
    memberId: string;
    memberName: string;
    lateCount: number;
    avgMinutesLate: number;
  }[];
  byBucket: { bucket: LateArrivalBucket; count: number }[];
  lastUpdated: string;
}

export function getLateArrivals(params?: {
  dateFrom?: string;
  dateTo?: string;
  gracePeriodMinutes?: number;
  disciplineId?: string;
}): Promise<LateArrivalsData> {
  const qs = toQueryString({
    dateFrom: params?.dateFrom,
    dateTo: params?.dateTo,
    gracePeriodMinutes:
      params?.gracePeriodMinutes !== undefined
        ? String(params.gracePeriodMinutes)
        : undefined,
    disciplineId: params?.disciplineId,
  });
  return api.get<LateArrivalsData>(`/reports/late-arrivals${qs}`);
}

/* ──────────────────── Export ──────────────────── */

export interface ExportResponse {
  headers: string[];
  rows: (string | number | null)[][];
  fileName: string;
  generatedAt: string;
}

export async function exportReport(params: {
  reportType: string;
  format: 'excel' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
  disciplineId?: string;
}): Promise<ExportResponse> {
  const qs = toQueryString({
    reportType: params.reportType,
    format: params.format,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    disciplineId: params.disciplineId,
  });
  return api.get<ExportResponse>(`/reports/export${qs}`);
}
