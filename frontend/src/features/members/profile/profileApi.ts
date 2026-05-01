import { api } from '../../../lib/api';
import type {
  MemberProfile,
  AttendanceInfo,
  PaymentInfo,
  AuditLogEntry,
  NoteInfo,
  FamilyLinkInfo,
  PaginatedResponse,
} from './profileTypes';

export function getMemberProfile(id: string): Promise<{ member: MemberProfile }> {
  return api.get<{ member: MemberProfile }>(`/members/${id}/profile`);
}

export function getMemberAttendance(
  id: string,
  params?: {
    page?: number;
    limit?: number;
    month?: number;
    year?: number;
    disciplineId?: string;
  },
): Promise<PaginatedResponse<AttendanceInfo>> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.month !== undefined) qs.set('month', String(params.month));
  if (params?.year !== undefined) qs.set('year', String(params.year));
  if (params?.disciplineId) qs.set('disciplineId', params.disciplineId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<PaginatedResponse<AttendanceInfo>>(`/members/${id}/attendance${suffix}`);
}

export function getMemberPayments(
  id: string,
  params?: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<PaginatedResponse<PaymentInfo>> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.type) qs.set('type', params.type);
  if (params?.startDate) qs.set('startDate', params.startDate);
  if (params?.endDate) qs.set('endDate', params.endDate);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<PaginatedResponse<PaymentInfo>>(`/members/${id}/payments${suffix}`);
}

export function getMemberAuditLog(
  id: string,
  params?: {
    page?: number;
    limit?: number;
    userId?: string;
    tableName?: string;
  },
): Promise<PaginatedResponse<AuditLogEntry>> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.tableName) qs.set('tableName', params.tableName);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<PaginatedResponse<AuditLogEntry>>(`/members/${id}/audit-log${suffix}`);
}

export function createNote(memberId: string, content: string): Promise<{ note: NoteInfo }> {
  return api.post<{ note: NoteInfo }>(`/members/${memberId}/notes`, { content });
}

export function updateNote(
  memberId: string,
  noteId: string,
  content: string,
): Promise<{ note: NoteInfo }> {
  return api.patch<{ note: NoteInfo }>(`/members/${memberId}/notes/${noteId}`, { content });
}

export function deleteNote(memberId: string, noteId: string): Promise<void> {
  return api.delete<void>(`/members/${memberId}/notes/${noteId}`);
}

export function createFamilyLink(
  memberId: string,
  relatedMemberId: string,
  relationship: string,
): Promise<{ link: FamilyLinkInfo }> {
  return api.post<{ link: FamilyLinkInfo }>(`/members/${memberId}/family-links`, {
    relatedMemberId,
    relationship,
  });
}

export function deleteFamilyLink(memberId: string, linkId: string): Promise<void> {
  return api.delete<void>(`/members/${memberId}/family-links/${linkId}`);
}
