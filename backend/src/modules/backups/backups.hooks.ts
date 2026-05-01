import { getEnv } from '../../config/env.js';
import { createBackup } from './backups.service.js';

// ─── Debounced auto-backup ──────────────────────────────────────────────────
// Financial transactions can fire in rapid succession (bulk POS, refunds).
// We coalesce calls within a 30s window to avoid creating dozens of snapshots.

let pending: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 30_000;

export function scheduleAutoBackup(userId: string | null = null): void {
  const env = getEnv();
  if (!env.BACKUP_AUTO_ON_PAYMENT) return;

  if (pending) return; // already scheduled
  pending = setTimeout(() => {
    pending = null;
    // Fire-and-forget; createBackup has its own error logging via audit_logs.
    void createBackup('auto', userId).catch(() => undefined);
  }, DEBOUNCE_MS);
  // Do not keep the event loop alive solely for the backup timer.
  if (typeof pending.unref === 'function') pending.unref();
}

/** Used in tests to flush immediately. */
export async function flushAutoBackup(userId: string | null = null): Promise<void> {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  await createBackup('auto', userId).catch(() => undefined);
}
