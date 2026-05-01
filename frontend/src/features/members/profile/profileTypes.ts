export interface ContactInfo {
  id: string;
  type: 'phone' | 'email' | 'address';
  value: string;
  label: string | null;
  isPrimary: boolean;
}

export interface EmergencyContactInfo {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

export interface ScheduleInfo {
  id: string;
  dayOfWeek: number; // 0=Sun ... 6=Sat
  startTime: string; // "HH:mm"
  endTime: string;
}

export interface DisciplineEnrollment {
  id: string;
  disciplineId: string;
  disciplineName: string;
  instructorName: string | null;
  beltRank: string | null;
  enrollmentDate: string;
  status: string;
  schedules: ScheduleInfo[];
}

export interface DocumentInfo {
  id: string;
  type: string;
  status: 'valid' | 'expired' | 'pending';
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
}

export interface SubscriptionInfo {
  id: string;
  planName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  autoRenew: boolean;
  price: number; // centimes
}

export interface EquipmentPurchase {
  id: string;
  equipmentName: string;
  quantity: number;
  unitPrice: number; // centimes
  purchaseDate: string;
  paymentReceiptNo: string | null;
}

export interface FamilyLinkInfo {
  id: string;
  relatedMemberId: string;
  relatedMemberName: string;
  relatedMemberPhoto: string | null;
  relationship: string;
}

export interface PaymentItem {
  id: string;
  description: string;
  amount: number; // centimes
}

export interface PaymentInfo {
  id: string;
  receiptNo: string | null;
  date: string;
  total: number; // centimes
  paid: number;  // centimes
  remaining: number; // centimes
  type: string;
  items: PaymentItem[];
}

export interface NoteInfo {
  id: string;
  content: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceInfo {
  id: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  disciplineName: string;
  method: string;
  status: 'present' | 'absent' | 'excused';
}

export interface AuditLogEntry {
  id: string;
  tableName: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  createdAt: string;
}

export interface MemberProfile {
  id: string;
  type: 'athlete' | 'staff' | 'external';
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  photoPath: string | null;
  status: string;
  createdAt: string;
  contacts: ContactInfo[];
  emergencyContacts: EmergencyContactInfo[];
  disciplines: DisciplineEnrollment[];
  documents: DocumentInfo[];
  subscriptions: SubscriptionInfo[];
  equipmentPurchases: EquipmentPurchase[];
  familyLinks: FamilyLinkInfo[];
  payments: PaymentInfo[];
  notes: NoteInfo[];
  recentAttendance: AttendanceInfo[];
  balance: number; // centimes
  totalAttendance: number;
  documentsStatus: { valid: number; expired: number; pending: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
