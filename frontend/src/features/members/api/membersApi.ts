import { api, apiFetch } from '../../../lib/api';

export type MemberType = 'athlete' | 'staff' | 'external';
export type MemberStatus = 'pending' | 'active' | 'suspended' | 'inactive';
export type StaffRole = 'manager' | 'receptionist' | 'coach' | 'accountant';
export type Gender = 'male' | 'female';

export interface Wilaya {
  code: string;
  nameLatin: string;
  nameArabic: string;
}

export interface WilayasResponse {
  wilayas: Wilaya[];
}

export interface MemberContact {
  type: 'phone' | 'email' | 'address';
  value: string;
  isPrimary?: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface CreateMemberBody {
  type: MemberType;
}

export interface UpdateMemberBody {
  firstNameLatin?: string;
  lastNameLatin?: string;
  firstNameArabic?: string | null;
  lastNameArabic?: string | null;
  gender?: Gender;
  dateOfBirth?: string;
  placeOfBirth?: string | null;
  contacts?: MemberContact[];
  emergencyContacts?: EmergencyContact[];
}

export interface MemberRecord {
  id: string;
  type: MemberType;
  status: string;
  createdAt: string;
  photoUrl?: string | null;
}

export interface MemberListItem {
  id: string;
  type: MemberType;
  status: MemberStatus;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  photoPath: string | null;
  createdAt: string;
  disciplines: string[];
}

export type MemberScope =
  | 'unpaid'
  | 'renewal'
  | 'expiring'
  | 'docs'
  | 'inactive'
  | 'absent';

export interface ListMembersParams {
  search?: string;
  type?: MemberType;
  status?: MemberStatus;
  scope?: MemberScope;
  page?: number;
  pageSize?: number;
}

export interface ListMembersResponse {
  members: MemberListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function listMembers(params: ListMembersParams = {}): Promise<ListMembersResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.type) qs.set('type', params.type);
  if (params.status) qs.set('status', params.status);
  if (params.scope) qs.set('scope', params.scope);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return api.get<ListMembersResponse>(`/members${query ? `?${query}` : ''}`);
}

export interface DuplicateMember {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
}

export interface DuplicateResponse {
  duplicates: DuplicateMember[];
}

export interface PhotoUploadResponse {
  photoPath: string;
  photoUrl: string;
}

export function createMember(body: CreateMemberBody): Promise<MemberRecord> {
  return api.post<MemberRecord>('/members', body);
}

export function updateMember(id: string, body: UpdateMemberBody): Promise<MemberRecord> {
  return api.patch<MemberRecord>(`/members/${id}`, body);
}

export function checkDuplicate(
  firstName: string,
  lastName: string,
  lang: 'latin' | 'arabic' = 'latin',
): Promise<DuplicateResponse> {
  const qs = new URLSearchParams({
    firstName,
    lastName,
    lang,
  }).toString();
  return api.get<DuplicateResponse>(`/members/check-duplicate?${qs}`);
}

export function uploadMemberPhoto(id: string, blob: Blob): Promise<PhotoUploadResponse> {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  return apiFetch<PhotoUploadResponse>(`/members/${id}/photo`, {
    method: 'POST',
    body: form,
  });
}

export function getWilayas(): Promise<WilayasResponse> {
  return api.get<WilayasResponse>('/wilayas');
}

/* ──────────────────── Disciplines ──────────────────── */

export interface Discipline {
  id: string;
  name: string;
  isActive: boolean;
}

export interface DisciplinesResponse {
  disciplines: Discipline[];
}

export interface TimeSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
}

export interface TimeSlotsResponse {
  timeSlots: TimeSlot[];
}

export interface Instructor {
  id: string;
  fullNameLatin: string;
  fullNameArabic?: string | null;
}

export interface InstructorsResponse {
  instructors: Instructor[];
}

export interface EnrollmentBody {
  enrollments: Array<{
    disciplineId: string;
    instructorId: string | null;
    beltRank: string | null;
    schedules: Array<{
      dayOfWeek: number;
      timeSlotId: string;
    }>;
  }>;
}

export interface EnrollmentRecord {
  id: string;
  disciplineId: string;
}

export interface EnrollmentResponse {
  enrollments: EnrollmentRecord[];
}

export function getDisciplines(): Promise<DisciplinesResponse> {
  return api.get<DisciplinesResponse>('/disciplines');
}

export function getDisciplineTimeSlots(id: string): Promise<TimeSlotsResponse> {
  return api.get<TimeSlotsResponse>(`/disciplines/${id}/time-slots`);
}

export function getDisciplineInstructors(id: string): Promise<InstructorsResponse> {
  return api.get<InstructorsResponse>(`/disciplines/${id}/instructors`);
}

export function enrollMemberDisciplines(
  memberId: string,
  body: EnrollmentBody,
): Promise<EnrollmentResponse> {
  return api.post<EnrollmentResponse>(`/members/${memberId}/enrollments`, body);
}

/* ──────────────────── Documents ──────────────────── */

export interface DocumentsBody {
  documents: Array<{
    type: string;
    label: string;
    issueDate: string | null;
    expiryDate: string | null;
  }>;
}

export interface DocumentRecord {
  id: string;
  type: string;
}

export interface DocumentsResponse {
  documents: DocumentRecord[];
}

export interface UploadResponse {
  documentId: string;
  filePath: string;
}

export function saveMemberDocuments(
  memberId: string,
  body: DocumentsBody,
): Promise<DocumentsResponse> {
  return api.post<DocumentsResponse>(`/members/${memberId}/documents`, body);
}

export function uploadDocument(
  memberId: string,
  file: File,
  documentId: string,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('documentId', documentId);
  return apiFetch<UploadResponse>(`/members/${memberId}/documents/upload`, {
    method: 'POST',
    body: form,
  });
}

/* ──────────────────── Billing ──────────────────── */

export interface SubscriptionPlans {
  plans: Record<string, Record<string, number>>;
}

export interface EquipmentItem {
  id: string;
  name: string;
  price: number;
  disciplineId: string | null;
  stockQuantity: number;
}

export interface EquipmentResponse {
  equipment: EquipmentItem[];
}

export interface SearchMemberResult {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  photoUrl: string | null;
}

export interface SearchMembersResponse {
  members: SearchMemberResult[];
}

export interface BillingBody {
  subscriptions: Array<{
    disciplineId: string;
    planType: string;
    amount: number;
  }>;
  equipment: Array<{
    equipmentId: string;
    quantity: number;
  }>;
  familyLinks: Array<{
    relatedMemberId: string;
    relationship: string;
  }>;
  payment: {
    paymentType: 'full' | 'partial' | 'later';
    paidAmount: number;
    notes?: string;
  } | null;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
}

export interface BillingResponse {
  payment: PaymentRecord | null;
  subscriptions: Array<{ id: string; disciplineId: string }>;
  familyLinks: Array<{ id: string; relatedMemberId: string }>;
}

export function getSubscriptionPlans(): Promise<SubscriptionPlans> {
  return api.get<SubscriptionPlans>('/subscription-plans');
}

export function getEquipment(): Promise<EquipmentResponse> {
  return api.get<EquipmentResponse>('/equipment');
}

export function searchMembers(query: string): Promise<SearchMembersResponse> {
  return api.get<SearchMembersResponse>(`/members/search?q=${encodeURIComponent(query)}`);
}

export function createMemberBilling(
  memberId: string,
  body: BillingBody,
): Promise<BillingResponse> {
  return api.post<BillingResponse>(`/members/${memberId}/billing`, body);
}

/* ──────────────────── Finalization ──────────────────── */

export interface FinalizeResponse {
  member: MemberRecord & {
    status: string;
  };
}

export function finalizeMember(memberId: string): Promise<FinalizeResponse> {
  return api.post<FinalizeResponse>(`/members/${memberId}/finalize`);
}
