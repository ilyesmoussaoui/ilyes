import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import {
  FingerprintIcon,
  DollarIcon,
  UsersIcon,
  PackageIcon,
  FileTextIcon,
  BarChart3Icon,
  CalendarIcon,
  RefreshIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
} from '../../components/ui/Icon';
import type { SelectOption } from '../../types/ui';
import type { ReportFilters } from './reportsApi';
import { getDefaultDateRange } from './reportHelpers';
import { AttendanceReport } from './AttendanceReport';
import { FinancialReport } from './FinancialReport';
import { MembershipReport } from './MembershipReport';
import { InventoryReport } from './InventoryReport';
import { DocumentReport } from './DocumentReport';
import { CustomReportBuilder } from './CustomReportBuilder';
import { AbsencesReport } from './AbsencesReport';
import { LateArrivalsReport } from './LateArrivalsReport';
import { OutstandingBalancesReport } from './OutstandingBalancesReport';
import { DailyCashReport } from './DailyCashReport';
import { MissingDocumentsReport } from './MissingDocumentsReport';
import {
  CATEGORIES,
  REPORT_CARDS,
  REPORT_TITLES,
  type CatalogCategory,
  type ReportCard,
} from './reportsCatalog';
import { cn } from '../../lib/cn';

/* ──────────────────── Icon mapping ──────────────────── */

const CATEGORY_ICONS: Record<string, ReactNode> = {
  presence:   <FingerprintIcon size={16} />,
  finance:    <DollarIcon size={16} />,
  adherents:  <UsersIcon size={16} />,
  inventaire: <PackageIcon size={16} />,
  conformite: <FileTextIcon size={16} />,
  custom:     <BarChart3Icon size={16} />,
};

const CARD_ICONS: Record<string, ReactNode> = {
  fingerprint: <FingerprintIcon size={20} />,
  dollar:      <DollarIcon size={20} />,
  users:       <UsersIcon size={20} />,
  package:     <PackageIcon size={20} />,
  'file-text': <FileTextIcon size={20} />,
  'bar-chart-3': <BarChart3Icon size={20} />,
};

function getCardIcon(card: ReportCard): ReactNode {
  const cat = CATEGORIES.find((c) => c.id === card.categoryId);
  if (!cat) return <BarChart3Icon size={20} />;
  const iconKey = cat.id === 'presence' ? 'fingerprint'
    : cat.id === 'finance' ? 'dollar'
    : cat.id === 'adherents' ? 'users'
    : cat.id === 'inventaire' ? 'package'
    : cat.id === 'conformite' ? 'file-text'
    : 'bar-chart-3';
  return CARD_ICONS[iconKey] ?? <BarChart3Icon size={20} />;
}

/* ──────────────────── Group by ──────────────────── */

function useGroupByOptions(): SelectOption[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      { value: 'day', label: t('reports.filters.byDay') },
      { value: 'week', label: t('reports.filters.byWeek') },
      { value: 'month', label: t('reports.filters.byMonth') },
    ],
    [t],
  );
}

/* ──────────────────── View renderer ──────────────────── */

function renderView(viewId: string, filters: ReportFilters): ReactNode {
  switch (viewId) {
    case 'attendance_total':      return <AttendanceReport filters={filters} />;
    case 'attendance_absences':   return <AbsencesReport filters={filters} />;
    case 'attendance_late':       return <LateArrivalsReport filters={filters} />;
    case 'financial_revenue':     return <FinancialReport filters={filters} />;
    case 'financial_outstanding': return <OutstandingBalancesReport filters={filters} />;
    case 'financial_daily_cash':  return <DailyCashReport filters={filters} />;
    case 'inventory_stock':
    case 'inventory_sales':       return <InventoryReport filters={filters} />;
    case 'membership_overview':
    case 'membership_growth':
    case 'membership_active':
    case 'membership_demographics':
    case 'membership_new':        return <MembershipReport filters={filters} />;
    case 'documents_expired':
    case 'documents_expiring':    return <DocumentReport filters={filters} />;
    case 'documents_missing':     return <MissingDocumentsReport filters={filters} />;
    case 'custom':                return <CustomReportBuilder filters={filters} />;
    default:                      return null;
  }
}

/* ──────────────────── CatalogCard ──────────────────── */

interface CatalogCardProps {
  card: ReportCard;
  category: CatalogCategory;
  onClick: () => void;
}

function CatalogCard({ card, category, onClick }: CatalogCardProps) {
  const { t } = useTranslation();
  const title = t(`reports.cards.${card.id}.title`, { defaultValue: card.title });
  const description = t(`reports.cards.${card.id}.description`, {
    defaultValue: card.description,
  });
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-5 text-left shadow-elevation-1',
        'transition-all hover:border-primary-300 hover:shadow-elevation-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', category.cardBubbleClass)}>
          {getCardIcon(card)}
        </div>
        <ArrowRightIcon size={14} className="mt-1 shrink-0 text-neutral-300" />
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </button>
  );
}

/* ──────────────────── Page Component ──────────────────── */

export function ReportsPage() {
  const { t } = useTranslation();
  const groupByOptions = useGroupByOptions();
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
    groupBy: 'day',
  });

  const handleApply = useCallback(() => {
    setAppliedFilters({ dateFrom, dateTo, groupBy });
  }, [dateFrom, dateTo, groupBy]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleApply(); },
    [handleApply],
  );

  const groupedCards = useMemo(
    () => CATEGORIES.map((cat) => ({ category: cat, cards: REPORT_CARDS.filter((c) => c.categoryId === cat.id) })),
    [],
  );

  const activeCard = useMemo(() => activeView ? REPORT_CARDS.find((c) => c.id === activeView) : null, [activeView]);
  const activeCategory = useMemo(() => activeCard ? CATEGORIES.find((c) => c.id === activeCard.categoryId) : null, [activeCard]);

  const activeTitle = activeView
    ? t(`reports.cards.${activeView}.title`, {
        defaultValue: REPORT_TITLES[activeView] ?? activeView,
      })
    : '';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header>
        <h1 className="text-xl font-bold text-neutral-900">{t('reports.title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t('reports.subtitle')}
        </p>
      </header>

      {/* Global Filter Bar */}
      <section
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1"
        aria-label={t('reports.filters.aria')}
      >
        <div className="flex items-center gap-1.5 text-neutral-500">
          <CalendarIcon size={16} />
          <span className="text-xs font-medium uppercase tracking-wide">{t('reports.filters.label')}</span>
        </div>

        <div className="flex flex-1 flex-wrap items-end gap-3">
          <div className="w-full min-w-[140px] sm:w-auto">
            <label htmlFor="filter-from" className="mb-1 block text-xs font-medium text-neutral-600">{t('reports.filters.from')}</label>
            <input
              id="filter-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>

          <div className="w-full min-w-[140px] sm:w-auto">
            <label htmlFor="filter-to" className="mb-1 block text-xs font-medium text-neutral-600">{t('reports.filters.to')}</label>
            <input
              id="filter-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>

          <div className="w-full min-w-[120px] sm:w-36">
            <Select
              label={t('reports.filters.groupBy')}
              options={groupByOptions}
              value={groupBy}
              onChange={(v) => setGroupBy(v as 'day' | 'week' | 'month')}
            />
          </div>
        </div>

        <Button variant="primary" onClick={handleApply} iconLeft={<RefreshIcon size={16} />}>
          {t('reports.filters.apply')}
        </Button>
      </section>

      {/* Active Report View */}
      {activeView !== null ? (
        <section aria-label={activeTitle}>
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <ChevronLeftIcon size={16} />
              {t('reports.navigation.backToCatalog')}
            </button>
            <span className="text-neutral-300" aria-hidden>/</span>
            <div className="flex items-center gap-2">
              {activeCategory && (
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', activeCategory.cardBubbleClass)}>
                  {activeCard && getCardIcon(activeCard)}
                </div>
              )}
              <h2 className="text-sm font-semibold text-neutral-800">
                {activeTitle}
              </h2>
            </div>
          </div>
          {renderView(activeView, appliedFilters)}
        </section>
      ) : (
        /* Catalog Grid */
        <section aria-label={t('reports.navigation.catalog')}>
          <div className="space-y-10">
            {groupedCards.map(({ category, cards }) => {
              if (cards.length === 0) return null;
              return (
                <div key={category.id}>
                  <div className="mb-4 flex items-center gap-2">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', category.bubbleClass)}>
                      {CATEGORY_ICONS[category.id]}
                    </div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      {t(`reports.categories.${category.id}`, { defaultValue: category.label })}
                    </h2>
                    <div className="h-px flex-1 bg-neutral-100" aria-hidden />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) => (
                      <CatalogCard
                        key={card.id}
                        card={card}
                        category={category}
                        onClick={() => setActiveView(card.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
