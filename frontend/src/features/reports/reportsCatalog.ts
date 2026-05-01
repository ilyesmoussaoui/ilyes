import type { ReactNode } from 'react';

export type CategoryId = 'presence' | 'finance' | 'adherents' | 'inventaire' | 'conformite' | 'custom';

export interface ReportCard {
  id: string;
  title: string;
  description: string;
  categoryId: CategoryId;
}

export interface CatalogCategory {
  id: CategoryId;
  label: string;
  bubbleClass: string;
  cardBubbleClass: string;
}

export const CATEGORIES: CatalogCategory[] = [
  { id: 'presence',   label: 'Présence',                bubbleClass: 'bg-sky-100 text-sky-600',     cardBubbleClass: 'bg-sky-50 text-sky-600' },
  { id: 'finance',    label: 'Finance',                 bubbleClass: 'bg-emerald-100 text-emerald-600', cardBubbleClass: 'bg-emerald-50 text-emerald-600' },
  { id: 'adherents',  label: 'Adhérents',               bubbleClass: 'bg-violet-100 text-violet-600', cardBubbleClass: 'bg-violet-50 text-violet-600' },
  { id: 'inventaire', label: 'Inventaire',              bubbleClass: 'bg-amber-100 text-amber-600',  cardBubbleClass: 'bg-amber-50 text-amber-600' },
  { id: 'conformite', label: 'Conformité documents',    bubbleClass: 'bg-rose-100 text-rose-600',    cardBubbleClass: 'bg-rose-50 text-rose-600' },
  { id: 'custom',     label: 'Personnalisé',            bubbleClass: 'bg-indigo-100 text-indigo-600', cardBubbleClass: 'bg-indigo-50 text-indigo-600' },
];

export const REPORT_CARDS: ReportCard[] = [
  { id: 'attendance_total',      title: 'Total arrivées',          description: 'Volume de check-ins, disciplines et heures de pointe.',                 categoryId: 'presence' },
  { id: 'attendance_absences',   title: 'Absences',                description: 'Membres sans check-in depuis un nombre de jours configurable.',         categoryId: 'presence' },
  { id: 'attendance_late',       title: 'Retards',                 description: "Arrivées après l'heure prévue de la session.",                           categoryId: 'presence' },
  { id: 'financial_revenue',     title: 'Revenus',                 description: 'Revenus, dépenses, bénéfice net et membres les plus actifs.',            categoryId: 'finance' },
  { id: 'financial_outstanding', title: 'Soldes impayés',          description: 'Membres avec des paiements en attente, classés par ancienneté.',         categoryId: 'finance' },
  { id: 'financial_daily_cash',  title: 'Caisse journalière',      description: "Toutes les transactions d'une journée, heure par heure.",               categoryId: 'finance' },
  { id: 'inventory_sales',       title: 'Ventes & Stock',          description: 'Valeur du stock, articles vendus et mouvements.',                        categoryId: 'finance' },
  { id: 'membership_overview',   title: "Vue d'ensemble",          description: "Statuts, types d'abonnements et taux de rétention.",                    categoryId: 'adherents' },
  { id: 'membership_growth',     title: 'Croissance',              description: 'Nouveaux membres et évolution de la base active.',                       categoryId: 'adherents' },
  { id: 'membership_demographics', title: 'Démographie',           description: 'Répartition par âge et par genre.',                                      categoryId: 'adherents' },
  { id: 'inventory_stock',       title: 'Valeur du stock',         description: 'Niveaux de stock, articles en faible quantité et valeur totale.',        categoryId: 'inventaire' },
  { id: 'documents_missing',     title: 'Documents manquants',     description: 'Membres sans tous les documents requis.',                                categoryId: 'conformite' },
  { id: 'documents_expired',     title: 'Documents expirés',       description: 'Documents dont la date de validité est dépassée.',                       categoryId: 'conformite' },
  { id: 'documents_expiring',    title: 'Documents expirant bientôt', description: 'Documents qui arrivent à expiration prochainement.',                 categoryId: 'conformite' },
  { id: 'custom',                title: 'Rapport personnalisé',    description: 'Créez un rapport sur mesure en sélectionnant vos métriques.',            categoryId: 'custom' },
];

export const REPORT_TITLES: Record<string, string> = Object.fromEntries(
  REPORT_CARDS.map((c) => [c.id, c.title]),
);

/** Icon keys per category for UI rendering (mapped in ReportsPage) */
export const CATEGORY_ICON_KEY: Record<CategoryId, string> = {
  presence:   'fingerprint',
  finance:    'dollar',
  adherents:  'users',
  inventaire: 'package',
  conformite: 'file-text',
  custom:     'bar-chart-3',
};

/** Icon key per report card */
export const CARD_ICON_KEY: Record<string, string> = {
  attendance_total:        'fingerprint',
  attendance_absences:     'fingerprint',
  attendance_late:         'fingerprint',
  financial_revenue:       'dollar',
  financial_outstanding:   'dollar',
  financial_daily_cash:    'dollar',
  inventory_sales:         'package',
  membership_overview:     'users',
  membership_growth:       'users',
  membership_demographics: 'users',
  inventory_stock:         'package',
  documents_missing:       'file-text',
  documents_expired:       'file-text',
  documents_expiring:      'file-text',
  custom:                  'bar-chart-3',
};

// Satisfy ReactNode import — this file is pure data but re-exported for typing convenience.
export type { ReactNode };
