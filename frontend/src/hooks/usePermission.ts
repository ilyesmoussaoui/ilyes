import { Fragment, createElement, type ReactNode, type ReactElement } from 'react';
import { useAuthStore } from '../features/auth/authStore';
import { hasPermission } from '../lib/permissions';

/**
 * Hook that checks whether the current user has a specific permission.
 *
 * @example
 * const canEditMembers = usePermission('members', 'edit');
 */
export function usePermission(resource: string, action: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return hasPermission(permissions, resource, action);
}

/**
 * Component that conditionally renders children based on permissions.
 *
 * @example
 * <CanAccess resource="members" action="create">
 *   <Button>Add Member</Button>
 * </CanAccess>
 */
interface CanAccessProps {
  resource: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function CanAccess({
  resource,
  action,
  children,
  fallback,
}: CanAccessProps): ReactElement | null {
  const allowed = usePermission(resource, action);
  if (allowed) return createElement(Fragment, null, children);
  if (fallback) return createElement(Fragment, null, fallback);
  return null;
}
