import type { UserRole } from '@prisma/client';

export type UserSummary = {
  id: string;
  email: string;
  role: UserRole;
  roleId: string | null;
  fullNameLatin: string;
  fullNameArabic: string | null;
  lastLogin: string | null;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
};

export type SessionMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
  rememberMe?: boolean;
};

export const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  admin: ['dashboard', 'members', 'attendance', 'sessions', 'pos', 'payments', 'inventory', 'reports', 'settings', 'expenses', 'kiosk', 'disciplines', 'subscriptions', 'documents', 'notifications'],
  manager: ['dashboard', 'members', 'attendance', 'sessions', 'pos', 'payments', 'inventory', 'reports', 'expenses', 'kiosk', 'disciplines', 'subscriptions', 'documents', 'notifications'],
  receptionist: ['dashboard', 'members', 'attendance', 'pos', 'kiosk', 'disciplines', 'subscriptions', 'documents', 'notifications'],
  coach: ['dashboard', 'attendance', 'sessions', 'members', 'disciplines'],
  accountant: ['dashboard', 'pos', 'payments', 'inventory', 'reports', 'expenses', 'notifications'],
};
