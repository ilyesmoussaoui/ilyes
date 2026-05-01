import { useSyncExternalStore } from 'react';
import {
  getSyncSnapshot,
  subscribeSync,
  type SyncSnapshot,
} from '../lib/offline/syncService';

/**
 * Subscribes to the global sync service snapshot.
 *
 * The snapshot is mutable (a new object is emitted on change) so we can use
 * `useSyncExternalStore` directly without memoization.
 */
export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(
    (cb) => subscribeSync(cb),
    () => getSyncSnapshot(),
    () => getSyncSnapshot(),
  );
}
