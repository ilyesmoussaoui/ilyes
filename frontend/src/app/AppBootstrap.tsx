import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthStore } from '../features/auth/authStore';
import { setOnAuthFailure } from '../lib/api';
import { SpinnerIcon } from '../components/ui/Icon';

const PERMISSION_POLL_INTERVAL_MS = 30_000; // 30 seconds

interface AppBootstrapProps {
  children: ReactNode;
}

export function AppBootstrap({ children }: AppBootstrapProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setOnAuthFailure(() => {
      useAuthStore.getState().clear();
    });

    useAuthStore
      .getState()
      .fetchMe()
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      setOnAuthFailure(null);
    };
  }, []);

  // Poll for permission changes every 30 seconds while authenticated
  usePermissionPoller();

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-400"
      >
        <SpinnerIcon size={24} />
        <span className="sr-only">Loading application</span>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Periodically refreshes the user's permissions from the server.
 * When the backend changes a role's permissions, logged-in users will pick up
 * the change within PERMISSION_POLL_INTERVAL_MS. All Zustand subscribers
 * (sidebar, route guards, CanAccess components) re-render automatically.
 */
function usePermissionPoller() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      useAuthStore.getState().refreshPermissions();
    }, PERMISSION_POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated]);
}
