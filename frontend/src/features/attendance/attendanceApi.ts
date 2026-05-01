import { api, apiFetch } from '../../lib/api';

/* ──────────────────── Types ──────────────────── */

export interface AttendanceMember {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic: string;
  lastNameArabic: string;
  photoUrl: string | null;
  membershipType: string;
  paymentStatus: string;
}

export interface AttendanceDiscipline {
  id: string;
  name: string;
}

export interface PresentRecord {
  id: string;
  memberId: string;
  member: AttendanceMember;
  discipline: AttendanceDiscipline | null;
  checkInTime: string;
  method: 'face' | 'manual' | 'barcode';
}

export interface PresentResponse {
  records: PresentRecord[];
}

export interface CheckInBody {
  memberId: string;
  disciplineId?: string;
  method: 'face' | 'manual' | 'barcode';
  device?: string;
  notes?: string;
}

export interface MassCheckoutResponse {
  count: number;
}

export interface AttendanceOperator {
  id: string;
  fullNameLatin: string;
}

export interface AttendanceLogRecord {
  id: string;
  memberId: string;
  member: AttendanceMember;
  discipline: AttendanceDiscipline | null;
  checkInTime: string;
  checkOutTime: string | null;
  method: 'face' | 'manual' | 'barcode';
  status: 'present' | 'left';
  device: string | null;
  notes: string | null;
  operator: AttendanceOperator | null;
  createdAt: string;
}

/* ──────────────────── Audit history (Phase 3 stub) ──────────────────── */

export interface AttendanceAuditEntry {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string;
  userName: string;
  reason: string | null;
  createdAt: string;
}

export interface AttendanceHistoryResponse {
  entries: AttendanceAuditEntry[];
}

export interface AttendanceLogsResponse {
  records: AttendanceLogRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AttendanceLogsParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  memberId?: string;
  disciplineId?: string;
  method?: string;
  device?: string;
  status?: string;
  search?: string;
}

export interface TodayStats {
  totalCheckIns: number;
  currentlyPresent: number;
  totalCheckOuts: number;
}

export interface UpdateAttendanceBody {
  checkInTime?: string;
  checkOutTime?: string;
  disciplineId?: string;
  method?: string;
  notes?: string;
  reason: string;
}

export interface DeleteAttendanceBody {
  reason: string;
}

export interface SessionInfo {
  id: string;
  discipline: AttendanceDiscipline;
  startTime: string;
  endTime: string;
  enrolledCount: number;
}

export interface TodaySessionsResponse {
  sessions: SessionInfo[];
}

/* ──────────────────── API Functions ──────────────────── */

export function getPresentMembers(): Promise<PresentResponse> {
  return api.get<PresentResponse>('/attendance/present');
}

export function checkInMember(body: CheckInBody): Promise<PresentRecord> {
  return api.post<PresentRecord>('/attendance/checkin', body);
}

export function checkOutMember(id: string): Promise<void> {
  return api.post<void>(`/attendance/${id}/checkout`);
}

export function massCheckout(): Promise<MassCheckoutResponse> {
  return api.post<MassCheckoutResponse>('/attendance/mass-checkout');
}

export function getAttendanceLogs(params?: AttendanceLogsParams): Promise<AttendanceLogsResponse> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.startDate) qs.set('startDate', params.startDate);
  if (params?.endDate) qs.set('endDate', params.endDate);
  if (params?.memberId) qs.set('memberId', params.memberId);
  if (params?.disciplineId) qs.set('disciplineId', params.disciplineId);
  if (params?.method) qs.set('method', params.method);
  if (params?.device) qs.set('device', params.device);
  if (params?.status) qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<AttendanceLogsResponse>(`/attendance/logs${suffix}`);
}

export function getTodayStats(): Promise<TodayStats> {
  return api.get<TodayStats>('/attendance/stats/today');
}

export function getAttendanceRecord(id: string): Promise<AttendanceLogRecord> {
  return api.get<AttendanceLogRecord>(`/attendance/${id}`);
}

export function updateAttendance(id: string, body: UpdateAttendanceBody): Promise<AttendanceLogRecord> {
  return api.patch<AttendanceLogRecord>(`/attendance/${id}`, body);
}

export function deleteAttendance(id: string, body: DeleteAttendanceBody): Promise<void> {
  return apiFetch<void>(`/attendance/${id}`, { method: 'DELETE', body });
}

export function getTodaySessions(): Promise<TodaySessionsResponse> {
  return api.get<TodaySessionsResponse>('/attendance/sessions/today');
}

/* ──────────────────── Export helper ──────────────────── */

/**
 * Fetches up to 1000 records with the current filter set for client-side CSV export.
 */
export function exportAttendanceLogs(
  params: Omit<AttendanceLogsParams, 'page' | 'limit'>,
): Promise<AttendanceLogsResponse> {
  return getAttendanceLogs({ ...params, page: 1, limit: 1000 });
}

/* ──────────────────── Audit history (Phase 3 stub) ──────────────────── */
// TODO (Phase 3): implement GET /attendance/:id/history on the backend.
// The endpoint should return audit log entries for the given attendance record.
export function getAttendanceHistory(
  _id: string,
): Promise<AttendanceHistoryResponse> {
  // Stub — endpoint not yet implemented.
  return Promise.reject(new Error('STUB'));
}
