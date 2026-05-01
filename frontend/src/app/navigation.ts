import type { Role } from '../types/auth';
import { hasPermission } from '../lib/permissions';

export type { Role };

export interface MenuItem {
  id: string;
  /** Translation key for the menu label. Resolve via `t(labelKey)`. */
  labelKey: string;
  icon: string;
  path: string;
  /** Legacy role-based access. Kept for backward compat. */
  roles: Role[];
  /** New permission-based access — format: "resource:action" */
  permission: string;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dashboard',
    labelKey: 'sidebar.menu.dashboard',
    icon: 'layout-dashboard',
    path: '/dashboard',
    roles: ['admin', 'manager', 'receptionist', 'coach', 'accountant'],
    permission: 'dashboard:view',
  },
  {
    id: 'members',
    labelKey: 'sidebar.menu.members',
    icon: 'users',
    path: '/members',
    roles: ['admin', 'manager', 'receptionist'],
    permission: 'members:view',
  },
  {
    id: 'attendance',
    labelKey: 'sidebar.menu.attendance',
    icon: 'fingerprint',
    path: '/attendance',
    roles: ['admin', 'manager', 'receptionist', 'coach'],
    permission: 'attendance:view',
  },
  {
    id: 'sessions',
    labelKey: 'sidebar.menu.sessions',
    icon: 'calendar',
    path: '/sessions',
    roles: ['admin', 'manager', 'coach'],
    permission: 'sessions:view',
  },
  {
    id: 'pos',
    labelKey: 'sidebar.menu.pos',
    icon: 'shopping-cart',
    path: '/pos',
    roles: ['admin', 'manager', 'receptionist', 'accountant'],
    permission: 'pos:view',
  },
  {
    id: 'payments',
    labelKey: 'sidebar.menu.payments',
    icon: 'credit-card',
    path: '/payments',
    roles: ['admin', 'manager', 'accountant'],
    permission: 'payments:view',
  },
  {
    id: 'inventory',
    labelKey: 'sidebar.menu.inventory',
    icon: 'package',
    path: '/inventory',
    roles: ['admin', 'manager', 'accountant'],
    permission: 'inventory:view',
  },
  {
    id: 'expenses',
    labelKey: 'sidebar.menu.expenses',
    icon: 'file-text',
    path: '/expenses',
    roles: ['admin', 'manager', 'accountant'],
    permission: 'expenses:view',
  },
  {
    id: 'reports',
    labelKey: 'sidebar.menu.reports',
    icon: 'bar-chart-3',
    path: '/reports',
    roles: ['admin', 'manager', 'accountant'],
    permission: 'reports:view',
  },
  {
    id: 'settings',
    labelKey: 'sidebar.menu.settings',
    icon: 'settings',
    path: '/settings',
    roles: ['admin'],
    permission: 'settings:view',
  },
];

/**
 * Legacy: filter menu items by role.
 * @deprecated Use `menuForPermissions` instead.
 */
export function menuForRole(role: Role): MenuItem[] {
  return MENU_ITEMS.filter((item) => item.roles.includes(role));
}

/**
 * Filter menu items by the user's granular permission strings.
 */
export function menuForPermissions(permissions: string[]): MenuItem[] {
  return MENU_ITEMS.filter((item) => {
    const [resource, action] = item.permission.split(':');
    return hasPermission(permissions, resource, action);
  });
}
