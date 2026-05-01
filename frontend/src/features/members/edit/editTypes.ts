// ──────────────────────────────────────────────
// Edit Member — Form State Types
// ──────────────────────────────────────────────

export interface IdentityFormState {
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic: string;
  lastNameArabic: string;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  placeOfBirth: string; // wilaya code
}

export interface PhoneEntry {
  id: string;
  value: string;
}

export interface EmailEntry {
  id: string;
  value: string;
}

export interface EmergencyContactEntry {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface ContactFormState {
  phones: PhoneEntry[];
  emails: EmailEntry[];
  address: string;
  emergencyContacts: EmergencyContactEntry[];
}

export interface EnrollmentScheduleEntry {
  id: string; // server ID if existing, client ID if new
  dayOfWeek: number;
  timeSlotId: string;
  startTime: string;
  endTime: string;
}

export interface EnrollmentFormEntry {
  id: string; // server enrollment ID
  disciplineId: string;
  disciplineName: string;
  instructorId: string | null;
  beltRank: string | null;
  schedules: EnrollmentScheduleEntry[];
}

export interface DisciplinesFormState {
  enrollments: EnrollmentFormEntry[];
}

export interface DocumentFormEntry {
  id: string;
  type: string;
  status: 'valid' | 'expired' | 'pending';
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  pendingFile: File | null;
}

export interface DocumentsFormState {
  documents: DocumentFormEntry[];
}

export interface SubscriptionFormEntry {
  id: string;
  disciplineName: string;
  planType: string;
  startDate: string;
  endDate: string | null;
  status: string;
  autoRenew: boolean;
  price: number;
}

export interface BillingFormState {
  subscriptions: SubscriptionFormEntry[];
}

/** Tab IDs */
export type EditTabId =
  | 'identity'
  | 'photo'
  | 'contact'
  | 'disciplines'
  | 'documents'
  | 'billing'
  | 'equipment'
  | 'schedule'
  | 'family'
  | 'notes'
  | 'audit';
