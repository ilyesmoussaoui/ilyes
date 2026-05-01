import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn';
import type { EditTabId } from './editTypes';
import {
  UserIcon,
  CameraIcon,
  PhoneIcon,
  FingerprintIcon,
  FileTextIcon,
  CreditCardIcon,
  ShoppingCartIcon,
  ClockIcon,
  UsersIcon,
  EditIcon,
  EyeIcon,
} from '../../../components/ui/Icon';

interface TabConfig {
  id: EditTabId;
  labelKey: string;
  icon: ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'identity', labelKey: 'members.edit.tabs.identity', icon: <UserIcon size={16} /> },
  { id: 'photo', labelKey: 'members.edit.tabs.photo', icon: <CameraIcon size={16} /> },
  { id: 'contact', labelKey: 'members.edit.tabs.contact', icon: <PhoneIcon size={16} /> },
  { id: 'disciplines', labelKey: 'members.edit.tabs.disciplines', icon: <FingerprintIcon size={16} /> },
  { id: 'documents', labelKey: 'members.edit.tabs.documents', icon: <FileTextIcon size={16} /> },
  { id: 'billing', labelKey: 'members.edit.tabs.billing', icon: <CreditCardIcon size={16} /> },
  { id: 'equipment', labelKey: 'members.edit.tabs.equipment', icon: <ShoppingCartIcon size={16} /> },
  { id: 'schedule', labelKey: 'members.edit.tabs.schedule', icon: <ClockIcon size={16} /> },
  { id: 'family', labelKey: 'members.edit.tabs.family', icon: <UsersIcon size={16} /> },
  { id: 'notes', labelKey: 'members.edit.tabs.notes', icon: <EditIcon size={16} /> },
  { id: 'audit', labelKey: 'members.edit.tabs.audit', icon: <EyeIcon size={16} /> },
];

interface EditTabNavProps {
  activeTab: EditTabId;
  isDirty: boolean;
  onTabClick: (tabId: EditTabId) => void;
}

export function EditTabNav({ activeTab, isDirty, onTabClick }: EditTabNavProps) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('members.edit.title')}
      className="w-full overflow-x-auto border-b border-neutral-200 bg-white"
    >
      <ul
        role="tablist"
        className="flex min-w-max items-stretch gap-0 px-2"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <li key={tab.id} role="none">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => onTabClick(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
                  isActive
                    ? 'text-primary-600'
                    : 'text-neutral-500 hover:text-neutral-800',
                )}
              >
                <span className="shrink-0" aria-hidden>{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>

                {/* Dirty indicator dot — shows when this tab is active and has unsaved changes */}
                {isActive && isDirty && (
                  <span
                    aria-label={t('common.messages.unsavedChanges')}
                    className="ml-0.5 h-1.5 w-1.5 rounded-full bg-warning-fg"
                  />
                )}

                {/* Active underline */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary-500"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
