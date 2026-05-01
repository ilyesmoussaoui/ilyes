import { api, apiFetch } from '../../../lib/api';
import type { MemberRecord } from '../api/membersApi';

// ──────────────────────────────────────────────
// Identity / Contact
// ──────────────────────────────────────────────

export interface IdentityUpdateBody {
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
}

export function updateMemberIdentity(
  id: string,
  body: IdentityUpdateBody,
): Promise<MemberRecord> {
  return api.patch<MemberRecord>(`/members/${id}`, body);
}

export interface ContactUpdateBody {
  contacts: Array<{
    type: 'phone' | 'email' | 'address';
    value: string;
    isPrimary?: boolean;
  }>;
  emergencyContacts: Array<{
    name: string;
    phone: string;
    relationship: string;
  }>;
}

export function updateMemberContacts(
  id: string,
  body: ContactUpdateBody,
): Promise<MemberRecord> {
  return api.patch<MemberRecord>(`/members/${id}`, body);
}

// ──────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────

export function deleteMember(id: string): Promise<void> {
  return api.delete<void>(`/members/${id}`);
}

// ──────────────────────────────────────────────
// Photo
// ──────────────────────────────────────────────

export interface PhotoUploadResponse {
  photoPath: string;
  photoUrl: string;
}

export function replaceMemberPhoto(
  id: string,
  blob: Blob,
): Promise<PhotoUploadResponse> {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  return apiFetch<PhotoUploadResponse>(`/members/${id}/photo`, {
    method: 'POST',
    body: form,
  });
}

// ──────────────────────────────────────────────
// Enrollments / Disciplines
// ──────────────────────────────────────────────

export type AddEnrollmentPlanType =
  | 'monthly'
  | 'quarterly'
  | 'biannual'
  | 'annual'
  | 'session_pack';

export type AddEnrollmentPaymentType = 'full' | 'partial' | 'later';

export interface AddEnrollmentBilling {
  planType: AddEnrollmentPlanType;
  amount: number; // centimes
  startDate?: string; // ISO date (YYYY-MM-DD)
  payment: {
    paymentType: AddEnrollmentPaymentType;
    paidAmount?: number; // centimes
    notes?: string;
  };
}

export interface AddEnrollmentBody {
  disciplineId: string;
  instructorId: string | null;
  beltRank: string | null;
  schedules: Array<{ dayOfWeek: number; timeSlotId: string }>;
  billing?: AddEnrollmentBilling;
}

export interface UpdateEnrollmentBody {
  instructorId?: string | null;
  beltRank?: string | null;
  schedules?: Array<{ dayOfWeek: number; timeSlotId: string }>;
}

export interface EnrollmentRecord {
  id: string;
  disciplineId: string;
}

export interface EnrollmentSubscriptionRecord {
  id: string;
  planType: string;
  amount: number;
  startDate: string;
  endDate: string;
}

export interface EnrollmentPaymentRecord {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  paymentType: AddEnrollmentPaymentType;
}

export interface AddEnrollmentResponse {
  enrollment: EnrollmentRecord;
  subscription: EnrollmentSubscriptionRecord | null;
  payment: EnrollmentPaymentRecord | null;
}

export function addEnrollment(
  memberId: string,
  body: AddEnrollmentBody,
): Promise<AddEnrollmentResponse> {
  return api.post<AddEnrollmentResponse>(
    `/members/${memberId}/enrollments/add`,
    body,
  );
}

export function updateEnrollment(
  memberId: string,
  enrollmentId: string,
  body: UpdateEnrollmentBody,
): Promise<{ enrollment: EnrollmentRecord }> {
  return api.patch<{ enrollment: EnrollmentRecord }>(
    `/members/${memberId}/enrollments/${enrollmentId}`,
    body,
  );
}

export function deleteEnrollment(
  memberId: string,
  enrollmentId: string,
): Promise<void> {
  return api.delete<void>(`/members/${memberId}/enrollments/${enrollmentId}`);
}

// ──────────────────────────────────────────────
// Documents
// ──────────────────────────────────────────────

export interface AddDocumentBody {
  type: string;
  issueDate: string | null;
  expiryDate: string | null;
}

export interface UpdateDocumentBody {
  issueDate?: string | null;
  expiryDate?: string | null;
  status?: 'valid' | 'expired' | 'pending';
}

export interface DocumentRecord {
  id: string;
  type: string;
  status: string;
}

export function addDocument(
  memberId: string,
  body: AddDocumentBody,
): Promise<{ document: DocumentRecord }> {
  return api.post<{ document: DocumentRecord }>(
    `/members/${memberId}/documents/add`,
    body,
  );
}

export function updateDocument(
  memberId: string,
  docId: string,
  body: UpdateDocumentBody,
): Promise<{ document: DocumentRecord }> {
  return api.patch<{ document: DocumentRecord }>(
    `/members/${memberId}/documents/${docId}`,
    body,
  );
}

export function deleteDocument(memberId: string, docId: string): Promise<void> {
  return api.delete<void>(`/members/${memberId}/documents/${docId}`);
}

export interface DocumentUploadResponse {
  documentId: string;
  filePath: string;
}

export function uploadDocumentFile(
  memberId: string,
  file: File,
  documentId: string,
): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('documentId', documentId);
  return apiFetch<DocumentUploadResponse>(
    `/members/${memberId}/documents/upload`,
    { method: 'POST', body: form },
  );
}

// ──────────────────────────────────────────────
// Subscriptions / Billing
// ──────────────────────────────────────────────

export interface UpdateSubBody {
  planType?: string;
  autoRenew?: boolean;
  endDate?: string | null;
}

export interface RenewSubBody {
  planType: string;
  amount: number;
}

export interface SubscriptionRecord {
  id: string;
  planName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  autoRenew: boolean;
  price: number;
}

export function updateSubscription(
  memberId: string,
  subId: string,
  body: UpdateSubBody,
): Promise<{ subscription: SubscriptionRecord }> {
  return api.patch<{ subscription: SubscriptionRecord }>(
    `/members/${memberId}/subscriptions/${subId}`,
    body,
  );
}

export function renewSubscription(
  memberId: string,
  subId: string,
  body: RenewSubBody,
): Promise<{ subscription: SubscriptionRecord }> {
  return api.post<{ subscription: SubscriptionRecord }>(
    `/members/${memberId}/subscriptions/${subId}/renew`,
    body,
  );
}
