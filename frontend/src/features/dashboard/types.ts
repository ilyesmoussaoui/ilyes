export interface AlertMember {
  memberId: string;
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic?: string | null;
  lastNameArabic?: string | null;
  photoPath?: string | null;
  discipline?: string | null;
  renewalDate?: string | null;
  extra?: {
    balanceDue?: number;
    daysInactive?: number;
    missingDocTypes?: string[];
  };
}

export interface AlertStockItem {
  equipmentId: string;
  name: string;
  stockQuantity: number;
}

export interface DashboardAlertsData {
  subscriptionsExpiring: AlertMember[];
  unpaidBalance: AlertMember[];
  renewalNeeded: AlertMember[];
  missingDocuments: AlertMember[];
  inactiveMembers: AlertMember[];
  absentToday: AlertMember[];
  stockOut: AlertStockItem[];
}

export type SeverityTier = 'danger' | 'warning' | 'info';

export interface SectionConfig {
  key: string;
  titleFr: string;
  severity: SeverityTier;
  highlightParam: string;
  accentBar: string;
  countPill: string;
  dotClass: string;
}
