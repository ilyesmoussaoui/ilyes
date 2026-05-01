import { useEffect, type ReactNode } from 'react';
import { useToast } from '../components/ui';
import { startSyncService, setConflictHandler } from '../lib/offline/syncService';
import { registerServiceWorker } from '../lib/offline/registerSW';

/**
 * App-level provider that:
 *   1. Registers the service worker (PWA shell + runtime caches)
 *   2. Starts the offline sync service (drains queued mutations on reconnect)
 *   3. Surfaces server-wins conflicts via toast
 *
 * Mount once near the root, inside `ToastProvider`.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  useEffect(() => {
    void registerServiceWorker();
    const stop = startSyncService();

    setConflictHandler((mutation, message) => {
      toast.show({
        type: 'error',
        title: 'Sync conflict (server wins)',
        description: `${mutation.label}: ${message}`,
      });
    });

    return () => {
      stop();
      setConflictHandler(null);
    };
  }, [toast]);

  return <>{children}</>;
}
