import { Suspense, lazy, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Icon, Card } from '../../components/ui';
import { ChevronRightIcon, SpinnerIcon } from '../../components/ui/Icon';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

const GeneralSettings = lazy(() =>
  import('./GeneralSettings').then((m) => ({ default: m.GeneralSettings })),
);
const UsersSettings = lazy(() =>
  import('./UsersSettings').then((m) => ({ default: m.UsersSettings })),
);
const RolesSettings = lazy(() =>
  import('./RolesSettings').then((m) => ({ default: m.RolesSettings })),
);
const DisciplinesSettings = lazy(() =>
  import('./DisciplinesSettings').then((m) => ({ default: m.DisciplinesSettings })),
);
const PricingSettings = lazy(() =>
  import('./PricingSettings').then((m) => ({ default: m.PricingSettings })),
);
const DocumentsSettings = lazy(() =>
  import('./DocumentsSettings').then((m) => ({ default: m.DocumentsSettings })),
);
const NotificationsSettings = lazy(() =>
  import('./NotificationsSettings').then((m) => ({ default: m.NotificationsSettings })),
);

interface TabDef {
  key: string;
  labelKey: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: 'general', labelKey: 'settings.tabs.general', icon: 'settings' },
  { key: 'users', labelKey: 'settings.tabs.users', icon: 'users' },
  { key: 'roles', labelKey: 'settings.tabs.roles', icon: 'lock' },
  { key: 'disciplines', labelKey: 'settings.tabs.disciplines', icon: 'calendar' },
  { key: 'pricing', labelKey: 'settings.tabs.pricing', icon: 'credit-card' },
  { key: 'documents', labelKey: 'settings.tabs.documents', icon: 'file-text' },
  { key: 'notifications', labelKey: 'settings.tabs.notifications', icon: 'bell' },
  { key: 'language', labelKey: 'settings.tabs.language', icon: 'globe' },
];

function LanguageSettings() {
  const { t } = useTranslation();
  return (
    <Card title={t('language.title')}>
      <p className="mb-5 text-sm text-neutral-500">{t('language.description')}</p>
      <LanguageSwitcher />
    </Card>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'general';

  const lazyFallback = (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[200px] items-center justify-center text-neutral-400"
    >
      <SpinnerIcon size={20} />
      <span className="sr-only">{t('common.status.loading')}</span>
    </div>
  );

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const content = useMemo(() => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'users':
        return <UsersSettings />;
      case 'roles':
        return <RolesSettings />;
      case 'disciplines':
        return <DisciplinesSettings />;
      case 'pricing':
        return <PricingSettings />;
      case 'documents':
        return <DocumentsSettings />;
      case 'notifications':
        return <NotificationsSettings />;
      case 'language':
        return <LanguageSettings />;
      default:
        return <GeneralSettings />;
    }
  }, [activeTab]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Breadcrumb */}
      <nav aria-label={t('app.breadcrumb')} className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {t('app.home')}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="font-semibold text-neutral-700">{t('settings.breadcrumb')}</li>
        </ol>
      </nav>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Tab Bar */}
      <div
        role="tablist"
        aria-label={t('settings.tabsAria')}
        className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
              activeTab === tab.key
                ? 'bg-white text-primary-700 shadow-elevation-1'
                : 'text-neutral-600 hover:bg-white/60 hover:text-neutral-800',
            )}
          >
            <Icon name={tab.icon} size={16} />
            <span className="hidden sm:inline">{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="min-h-[400px]"
      >
        <Suspense fallback={lazyFallback}>{content}</Suspense>
      </div>
    </div>
  );
}
