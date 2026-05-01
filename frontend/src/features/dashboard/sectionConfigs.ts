import type { SectionConfig } from './types';

export const SECTION_CONFIGS: Record<string, SectionConfig> = {
  unpaidBalance: {
    key: 'unpaidBalance',
    titleFr: 'Solde impayé',
    severity: 'danger',
    highlightParam: 'balance',
    accentBar: 'bg-danger',
    countPill: 'bg-danger-bg text-danger-fg border-danger/20',
    dotClass: 'bg-danger',
  },
  stockOut: {
    key: 'stockOut',
    titleFr: 'Rupture de stock',
    severity: 'danger',
    highlightParam: '',
    accentBar: 'bg-danger',
    countPill: 'bg-danger-bg text-danger-fg border-danger/20',
    dotClass: 'bg-danger',
  },
  subscriptionsExpiring: {
    key: 'subscriptionsExpiring',
    titleFr: 'Abonnements expirant',
    severity: 'warning',
    highlightParam: 'subscriptions',
    accentBar: 'bg-warning',
    countPill: 'bg-warning-bg text-warning-fg border-warning/30',
    dotClass: 'bg-warning',
  },
  renewalNeeded: {
    key: 'renewalNeeded',
    titleFr: 'Renouvellement requis',
    severity: 'warning',
    highlightParam: 'subscriptions',
    accentBar: 'bg-warning',
    countPill: 'bg-warning-bg text-warning-fg border-warning/30',
    dotClass: 'bg-warning',
  },
  missingDocuments: {
    key: 'missingDocuments',
    titleFr: 'Documents manquants',
    severity: 'warning',
    highlightParam: 'documents',
    accentBar: 'bg-warning',
    countPill: 'bg-warning-bg text-warning-fg border-warning/30',
    dotClass: 'bg-warning',
  },
  inactiveMembers: {
    key: 'inactiveMembers',
    titleFr: 'Membres inactifs',
    severity: 'info',
    highlightParam: 'attendance',
    accentBar: 'bg-info',
    countPill: 'bg-info-bg text-info-fg border-info/20',
    dotClass: 'bg-info',
  },
  absentToday: {
    key: 'absentToday',
    titleFr: 'Membres absents',
    severity: 'info',
    highlightParam: 'attendance',
    accentBar: 'bg-info',
    countPill: 'bg-info-bg text-info-fg border-info/20',
    dotClass: 'bg-info',
  },
};

/** Ordered by urgency: danger → warning → info */
export const SECTION_ORDER: string[] = [
  'unpaidBalance',
  'stockOut',
  'subscriptionsExpiring',
  'renewalNeeded',
  'missingDocuments',
  'inactiveMembers',
  'absentToday',
];
