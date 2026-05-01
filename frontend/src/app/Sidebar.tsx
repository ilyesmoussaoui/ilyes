import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Icon } from '../components/ui';
import { useAuthStore } from '../features/auth/authStore';
import { menuForPermissions } from './navigation';
import { useSidebar } from './sidebarContext';
import type { Role } from '../types/auth';

const ROLE_KEY: Record<Role, string> = {
  admin: 'sidebar.roles.admin',
  manager: 'sidebar.roles.manager',
  receptionist: 'sidebar.roles.receptionist',
  coach: 'sidebar.roles.coach',
  accountant: 'sidebar.roles.accountant',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Sidebar() {
  const { t } = useTranslation();
  const { collapsed, toggle } = useSidebar();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!user) return null;

  const items = menuForPermissions(permissions);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      aria-label="Primary"
      className={cn(
        'fixed left-0 top-14 z-40 flex h-[calc(100vh-56px)] flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <nav aria-label={t('sidebar.menu.dashboard')} className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        <ul className="flex flex-col gap-1 px-2">
          {items.map((item) => {
            const label = t(item.labelKey);
            return (
            <li key={item.id}>
              <NavLink
                to={item.path}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary-600 text-white shadow-elevation-1'
                      : 'text-neutral-700 hover:bg-primary-50 hover:text-primary-700',
                  )
                }
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon name={item.icon} size={18} />
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap transition-opacity duration-150',
                    collapsed ? 'pointer-events-none w-0 opacity-0' : 'opacity-100',
                  )}
                >
                  {label}
                </span>
              </NavLink>
            </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-neutral-100 px-2 py-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-2',
            collapsed && 'justify-center px-0',
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
            {initials(user.fullNameLatin)}
          </span>
          <div
            className={cn(
              'min-w-0 flex-1 transition-opacity duration-150',
              collapsed ? 'pointer-events-none hidden w-0 opacity-0' : 'block opacity-100',
            )}
          >
            <p className="truncate text-sm font-semibold text-neutral-900">{user.fullNameLatin}</p>
            <p className="truncate text-xs text-neutral-500">{t(ROLE_KEY[user.role])}</p>
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t('sidebar.signOut')}
              title={t('sidebar.signOut')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Icon name="log-out" size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          aria-pressed={collapsed}
          className={cn(
            'mt-2 flex h-9 w-full items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          )}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
          {!collapsed && <span className="ml-2 text-xs font-medium">{t('sidebar.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
