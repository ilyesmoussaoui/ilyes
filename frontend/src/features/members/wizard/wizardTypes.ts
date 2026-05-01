import type { Gender, MemberType, StaffRole } from '../api/membersApi';

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

export interface WizardPhoto {
  blobUrl: string | null;
  uploaded: boolean;
  serverUrl: string | null;
}

export interface ScheduleSelection {
  dayOfWeek: number;        // 0-6
  timeSlotId: string;
  startTime: string;        // "HH:mm" for display
  endTime: string;          // "HH:mm" for display
}

export interface DisciplineEnrollment {
  id: string;               // client-side ID
  disciplineId: string;
  disciplineName: string;
  instructorId: string | null;
  beltRank: string | null;  // only for Taekwondo
  schedules: ScheduleSelection[];
}

export interface DocumentEntry {
  id: string;
  type: string;
  label: string;
  checked: boolean;
  filePath: string | null;
  pendingFile: File | null;
  issueDate: string | null;
  expiryDate: string | null;
}

export interface SubscriptionEntry {
  disciplineId: string;
  disciplineName: string;
  planType: string;
  amount: number;           // centimes
}

export interface EquipmentSelection {
  equipmentId: string;
  name: string;
  price: number;            // centimes per unit
  quantity: number;          // 1-6
}

export interface FamilyLinkEntry {
  relatedMemberId: string;
  relatedMemberName: string;
  relationship: string;
}

export interface WizardState {
  memberId: string | null;
  step: number;
  type: MemberType | null;
  staffRole: StaffRole | null;
  photo: WizardPhoto;
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic: string;
  lastNameArabic: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  wilayaCode: string | null;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  address: string;
  emergencyContacts: EmergencyContactEntry[];
  // Step 5: Disciplines
  disciplines: DisciplineEnrollment[];
  // Step 6: Documents
  documents: DocumentEntry[];
  // Step 7: Billing
  subscriptions: SubscriptionEntry[];
  equipmentSelections: EquipmentSelection[];
  familyLinks: FamilyLinkEntry[];
  paymentOption: 'full' | 'partial' | 'later';
  paidAmount: number;  // centimes
  // Step 8: populated after finalization
  finalMemberId: string | null;
  receiptNumber: string | null;
}

export type StepErrors = Record<string, string>;

export interface ValidationResult {
  ok: boolean;
  errors: StepErrors;
  firstInvalidFieldId?: string;
}

export const STEP_KEYS = [
  'classification',
  'photo',
  'identity',
  'contact',
  'disciplines',
  'documents',
  'billing',
  'review',
] as const;

export type StepKey = (typeof STEP_KEYS)[number];

/**
 * Fallback labels (French) — translations available under `members.wizard.stepNames.<key>`.
 * Use `t('members.wizard.stepNames.' + key)` where possible; these remain as a
 * safety net for non-React contexts.
 */
export const STEP_LABELS: Record<StepKey, string> = {
  classification: 'Classification',
  photo: 'Photo',
  identity: 'Identité',
  contact: 'Coordonnées',
  disciplines: 'Disciplines',
  documents: 'Documents',
  billing: 'Facturation',
  review: 'Résumé',
};

export const STEP_LABEL_KEYS: Record<StepKey, string> = {
  classification: 'members.wizard.stepNames.classification',
  photo: 'members.wizard.stepNames.photo',
  identity: 'members.wizard.stepNames.identity',
  contact: 'members.wizard.stepNames.contact',
  disciplines: 'members.wizard.stepNames.disciplines',
  documents: 'members.wizard.stepNames.documents',
  billing: 'members.wizard.stepNames.billing',
  review: 'members.wizard.stepNames.summary',
};

export function getVisibleSteps(type: MemberType | null): StepKey[] {
  if (type === 'staff' || type === 'external') {
    return STEP_KEYS.filter((k) => k !== 'disciplines' && k !== 'billing');
  }
  return [...STEP_KEYS];
}

export const EMPTY_WIZARD_STATE: WizardState = {
  memberId: null,
  step: 1,
  type: null,
  staffRole: null,
  photo: { blobUrl: null, uploaded: false, serverUrl: null },
  firstNameLatin: '',
  lastNameLatin: '',
  firstNameArabic: '',
  lastNameArabic: '',
  gender: null,
  dateOfBirth: null,
  wilayaCode: null,
  phones: [{ id: 'p-1', value: '' }],
  emails: [],
  address: '',
  emergencyContacts: [],
  // Step 5
  disciplines: [],
  // Step 6
  documents: [],
  // Step 7
  subscriptions: [],
  equipmentSelections: [],
  familyLinks: [],
  paymentOption: 'full',
  paidAmount: 0,
  // Step 8
  finalMemberId: null,
  receiptNumber: null,
};
