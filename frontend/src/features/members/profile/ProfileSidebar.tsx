import { cn } from '../../../lib/cn';
import type { MemberProfile } from './profileTypes';
import {
  LayoutDashboardIcon,
  UserIcon,
  PhoneIcon,
  FingerprintIcon,
  FileTextIcon,
  CalendarIcon,
  CreditCardIcon,
  ShoppingCartIcon,
  ClockIcon,
  UsersIcon,
  MessageSquareIcon,
  EyeIcon,
} from '../../../components/ui/Icon';

export type SectionId =
  | 'overview'
  | 'identity'
  | 'contact'
  | 'disciplines'
  | 'documents'
  | 'attendance'
  | 'payments'
  | 'equipment'
  | 'schedule'
  | 'family'
  | 'notes'
  | 'audit';

interface SectionItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface ProfileSidebarProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  profile: MemberProfile;
}

function getSections(profile: MemberProfile): SectionItem[] {
  const unpaidCount = profile.payments.filter((p) => p.remaining > 0).length;
  const expiredDocCount = profile.documentsStatus.expired;

  return [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboardIcon size={16} /> },
    { id: 'identity', label: 'Identity', icon: <UserIcon size={16} /> },
    { id: 'contact', label: 'Contact', icon: <PhoneIcon size={16} /> },
    { id: 'disciplines', label: 'Disciplines', icon: <FingerprintIcon size={16} />, badge: profile.disciplines.length || undefined },
    { id: 'documents', label: 'Documents', icon: <FileTextIcon size={16} />, badge: expiredDocCount > 0 ? expiredDocCount : undefined },
    { id: 'attendance', label: 'Attendance', icon: <CalendarIcon size={16} /> },
    { id: 'payments', label: 'Payments', icon: <CreditCardIcon size={16} />, badge: unpaidCount > 0 ? unpaidCount : undefined },
    { id: 'equipment', label: 'Equipment', icon: <ShoppingCartIcon size={16} />, badge: profile.equipmentPurchases.length || undefined },
    { id: 'schedule', label: 'Schedule', icon: <ClockIcon size={16} /> },
    { id: 'family', label: 'Family', icon: <UsersIcon size={16} />, badge: profile.familyLinks.length || undefined },
    { id: 'notes', label: 'Notes', icon: <MessageSquareIcon size={16} />, badge: profile.notes.length || undefined },
    { id: 'audit', label: 'Audit Log', icon: <EyeIcon size={16} /> },
  ];
}

export function ProfileSidebar({ activeSection, onSectionChange, profile }: ProfileSidebarProps) {
  const sections = getSections(profile);

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav
        aria-label="Profile sections"
        className="hidden lg:block w-52 shrink-0"
      >
        <ul className="flex flex-col gap-0.5" role="list">
          {sections.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onSectionChange(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    isActive
                      ? 'bg-primary-50 text-primary-700 shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  <span
                    className={cn(
                      'flex shrink-0 items-center',
                      isActive ? 'text-primary-600' : 'text-neutral-400',
                    )}
                  >
                    {section.icon}
                  </span>
                  <span className="flex-1 text-left">{section.label}</span>
                  {section.badge !== undefined && (
                    <span
                      className={cn(
                        'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold',
                        isActive
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-neutral-200 text-neutral-600',
                      )}
                    >
                      {section.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile/Tablet: horizontal scrollable tabs */}
      <nav
        aria-label="Profile sections"
        className="block lg:hidden"
      >
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <ul
            className="flex gap-1 pb-1 whitespace-nowrap"
            role="list"
          >
            {sections.map((section) => {
              const isActive = section.id === activeSection;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => onSectionChange(section.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all whitespace-nowrap',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      isActive
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50',
                    )}
                  >
                    <span className={cn('flex shrink-0 items-center', isActive ? 'text-white' : 'text-neutral-400')}>
                      {section.icon}
                    </span>
                    {section.label}
                    {section.badge !== undefined && (
                      <span
                        className={cn(
                          'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-xs font-semibold',
                          isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-600',
                        )}
                      >
                        {section.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
