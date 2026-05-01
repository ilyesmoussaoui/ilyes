import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Icon } from '../../components/ui/Icon';
import { useDashboardAlerts } from './hooks/useDashboardAlerts';
import { AlertSection, MAX_VISIBLE } from './components/AlertSection';
import { AlertCard } from './components/AlertCard';
import { StockAlertCard } from './components/StockAlertCard';
import { SECTION_CONFIGS, SECTION_ORDER } from './sectionConfigs';
import type { DashboardAlertsData, AlertMember } from './types';

// ---------------------------------------------------------------------------
// Summary bar chip
// ---------------------------------------------------------------------------
interface SummaryChipProps {
  label: string;
  count: number;
  pillClass: string;
  sectionId: string;
}

function SummaryChip({ label, count, pillClass, sectionId }: SummaryChipProps) {
  return (
    <a
      href={`#section-${sectionId}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer',
        pillClass,
      )}
    >
      {label}
      <span>{count}</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="flex items-center gap-2 text-danger">
        <Icon name="alert" size={20} />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-neutral-200',
          'px-4 py-2 text-sm font-medium text-neutral-700 bg-white',
          'hover:bg-neutral-50 transition-colors duration-150 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          'focus-visible:ring-offset-2',
        )}
      >
        <Icon name="refresh" size={14} />
        {t('dashboard.retry')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Count helper
// ---------------------------------------------------------------------------
function getCount(data: DashboardAlertsData | null, key: string): number {
  if (!data) return 0;
  const val = data[key as keyof DashboardAlertsData];
  return Array.isArray(val) ? val.length : 0;
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------
export function DashboardPage() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useDashboardAlerts();

  const translateSection = (key: string): string => {
    return t(`dashboard.sections.${key}`, { defaultValue: SECTION_CONFIGS[key]?.titleFr ?? key });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Sticky alert summary bar */}
      <div
        className={cn(
          'sticky top-0 z-40 bg-white border-b border-neutral-200',
          'flex items-center gap-2 px-4 h-10 overflow-x-auto scrollbar-none',
        )}
        role="navigation"
        aria-label={t('dashboard.alertSummaryAria')}
      >
        {SECTION_ORDER.map((key) => {
          const cfg = SECTION_CONFIGS[key];
          const count = getCount(data, key);
          if (!loading && count === 0) return null;
          return (
            <SummaryChip
              key={key}
              label={translateSection(key)}
              count={loading ? 0 : count}
              pillClass={cfg.countPill}
              sectionId={key}
            />
          );
        })}
        {loading && (
          <span className="text-xs text-neutral-400 animate-pulse">{t('dashboard.loadingShort')}</span>
        )}
      </div>

      {/* Page content */}
      <main className="px-4 md:px-6 py-6" id="dashboard-main">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">{t('dashboard.title')}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {error && !loading ? (
          <ErrorBanner message={error} onRetry={refetch} />
        ) : (
          <div
            className={cn(
              'grid grid-cols-1 gap-4',
              'md:grid-cols-2 md:gap-4',
              'lg:grid-cols-2 lg:gap-6',
            )}
          >
            {renderMemberSection('unpaidBalance', data, loading, false, t)}
            {renderStockSection(data, loading, t)}
            {renderMemberSection('subscriptionsExpiring', data, loading, false, t)}
            {renderMemberSection('renewalNeeded', data, loading, false, t)}
            {renderMemberSection('missingDocuments', data, loading, false, t)}
            {renderMemberSection('inactiveMembers', data, loading, false, t)}
            {renderMemberSection('absentToday', data, loading, true, t)}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section renderers (keep JSX out of the map to keep the template readable)
// ---------------------------------------------------------------------------

const SECTION_SCOPE: Record<string, string> = {
  unpaidBalance: 'unpaid',
  subscriptionsExpiring: 'expiring',
  renewalNeeded: 'renewal',
  missingDocuments: 'docs',
  inactiveMembers: 'inactive',
  absentToday: 'absent',
};

type TFn = (key: string, options?: Record<string, unknown>) => string;

function renderMemberSection(
  key: string,
  data: DashboardAlertsData | null,
  loading: boolean,
  isLast = false,
  t?: TFn,
) {
  const cfg = SECTION_CONFIGS[key];
  const members = data ? (data[key as keyof DashboardAlertsData] as AlertMember[]) : [];
  const count = members.length;
  const visible = members.slice(0, MAX_VISIBLE);
  const moreCount = count > MAX_VISIBLE ? count - MAX_VISIBLE : 0;

  const scope = SECTION_SCOPE[key];
  const href = scope ? `/members?scope=${scope}` : '/members';

  const title = t ? t(`dashboard.sections.${key}`, { defaultValue: cfg.titleFr }) : cfg.titleFr;
  const emptyLabel = t
    ? t('dashboard.emptyNoAlerts', { section: title.toLowerCase() })
    : `Aucune alerte — ${title.toLowerCase()}`;

  return (
    <AlertSection
      key={key}
      sectionKey={key}
      title={title}
      count={count}
      countPillClass={cfg.countPill}
      dotClass={cfg.dotClass}
      loading={loading}
      viewAllHref={href}
      emptyLabel={emptyLabel}
      moreCount={moreCount}
      moreHref={href}
      isLast={isLast}
    >
      {visible.map((member) => (
        <AlertCard
          key={member.memberId}
          member={member}
          accentBarClass={cfg.accentBar}
          highlightParam={cfg.highlightParam}
          sectionKey={key}
        />
      ))}
    </AlertSection>
  );
}

function renderStockSection(data: DashboardAlertsData | null, loading: boolean, t?: TFn) {
  const cfg = SECTION_CONFIGS['stockOut'];
  const items = data ? data.stockOut : [];
  const count = items.length;
  const visible = items.slice(0, MAX_VISIBLE);
  const moreCount = count > MAX_VISIBLE ? count - MAX_VISIBLE : 0;

  const title = t ? t('dashboard.sections.stockOut', { defaultValue: cfg.titleFr }) : cfg.titleFr;
  const emptyLabel = t ? t('dashboard.stockAllInStock') : 'Tous les articles sont en stock.';

  return (
    <AlertSection
      key="stockOut"
      sectionKey="stockOut"
      title={title}
      count={count}
      countPillClass={cfg.countPill}
      dotClass={cfg.dotClass}
      loading={loading}
      viewAllHref="/inventory"
      emptyLabel={emptyLabel}
      moreCount={moreCount}
      moreHref="/inventory"
    >
      {visible.map((item) => (
        <StockAlertCard key={item.equipmentId} item={item} />
      ))}
    </AlertSection>
  );
}
