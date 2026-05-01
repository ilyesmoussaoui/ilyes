import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../features/auth/authStore';
import { SpinnerIcon } from '../components/ui/Icon';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLocked = useAuthStore((s) => s.isLocked);
  const hasBootstrapped = useAuthStore((s) => s.hasBootstrapped);

  if (!hasBootstrapped) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-400"
      >
        <SpinnerIcon size={24} />
        <span className="sr-only">Loading session</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (isLocked) {
    return <Navigate to="/lock" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
