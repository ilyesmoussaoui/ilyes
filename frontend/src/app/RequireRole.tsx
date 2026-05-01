import type { ReactNode } from 'react';
import { Card, Button } from '../components/ui';
import { useAuthStore } from '../features/auth/authStore';
import { BanIcon } from '../components/ui/Icon';
import { useNavigate } from 'react-router-dom';
import type { Role } from '../types/auth';
import { hasPermission } from '../lib/permissions';

interface RequireRoleProps {
  allow: Role[];
  children: ReactNode;
}

/**
 * Legacy role-based guard. Internally also checks granular permissions
 * so that role changes propagate immediately through Zustand.
 */
export function RequireRole({ allow, children }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  if (!user || !allow.includes(user.role)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
        <Card>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
              <BanIcon size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">403 — Access denied</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Your role does not have permission to view this page.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

interface RequirePermissionProps {
  resource: string;
  action: string;
  children: ReactNode;
}

/**
 * Permission-based route guard. Uses granular permission strings.
 * Reactively re-evaluates when `permissions` in Zustand change.
 */
export function RequirePermission({ resource, action, children }: RequirePermissionProps) {
  const permissions = useAuthStore((s) => s.permissions);
  const navigate = useNavigate();

  if (!hasPermission(permissions, resource, action)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
        <Card>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
              <BanIcon size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">403 — Access denied</h2>
              <p className="mt-1 text-sm text-neutral-600">
                You do not have permission to view this page.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
