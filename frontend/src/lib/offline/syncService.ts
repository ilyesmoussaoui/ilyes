import { ApiError } from '../api';
import {
  countPending,
  listPending,
  notifyQueueChanged,
  removeMutation,
  updateMutation,
} from './queue';
import type { PendingMutation } from './db';

const DEFAULT_BASE_URL = 'http://localhost:4000';

function getBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  return fromEnv || DEFAULT_BASE_URL;
}

/** Retry schedule in milliseconds with jitter. Max ~10 minutes. */
function backoffDelay(attempts: number): number {
  const base = Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 10 * 60_000);
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(base, 10 * 60_000) + jitter;
}

/* ─────────────── Sync status (observable) ─────────────── */

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncSnapshot {
  state: SyncState;
  online: boolean;
  pending: number;
  failed: number;
  conflicts: number;
  lastError: string | null;
  lastSyncAt: number | null;
}

type SnapshotListener = (snap: SyncSnapshot) => void;

let snapshot: SyncSnapshot = {
  state: navigator.onLine ? 'idle' : 'offline',
  online: navigator.onLine,
  pending: 0,
  failed: 0,
  conflicts: 0,
  lastError: null,
  lastSyncAt: null,
};

const snapshotListeners = new Set<SnapshotListener>();

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot;
}

export function subscribeSync(listener: SnapshotListener): () => void {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
}

function updateSnapshot(patch: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const l of snapshotListeners) {
    try {
      l(snapshot);
    } catch {
      /* ignore */
    }
  }
}

async function refreshCounts(): Promise<void> {
  const all = await listPending();
  const pending = all.filter((m) => m.status === 'pending' || m.status === 'in-flight').length;
  const failed = all.filter((m) => m.status === 'failed').length;
  const conflicts = all.filter((m) => m.status === 'conflict').length;
  updateSnapshot({ pending, failed, conflicts });
}

/* ─────────────── Drain loop ─────────────── */

let draining = false;
let periodicTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Replays a single mutation against the server.
 * Returns true if processed (either success or terminal failure handled).
 */
async function replayOne(m: PendingMutation, conflictCallback?: ConflictCallback): Promise<void> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/v1${m.path.startsWith('/') ? m.path : `/${m.path}`}`;

  await updateMutation(m.id, { status: 'in-flight' });

  let response: Response;
  try {
    response = await fetch(url, {
      method: m.method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Idempotency-Key': m.idempotencyKey,
        'X-Client-Timestamp': String(m.clientTimestamp),
        'X-Offline-Replay': '1',
      },
      body: m.body === undefined ? undefined : JSON.stringify(m.body),
    });
  } catch {
    // Network failure — re-queue with backoff
    const attempts = m.attempts + 1;
    await updateMutation(m.id, {
      attempts,
      status: 'pending',
      lastError: 'Network error',
      nextAttemptAt: Date.now() + backoffDelay(attempts),
    });
    throw new ApiError('NETWORK_ERROR', 'Network error', 0);
  }

  if (response.ok) {
    await removeMutation(m.id);
    return;
  }

  // 409 Conflict — server-wins. Surface to the user and drop.
  if (response.status === 409) {
    let message = 'Server rejected a queued change (conflict).';
    try {
      const envelope = (await response.json()) as {
        error?: { message?: string; code?: string };
      };
      if (envelope.error?.message) message = envelope.error.message;
    } catch {
      /* ignore */
    }
    await updateMutation(m.id, { status: 'conflict', lastError: message });
    conflictCallback?.(m, message);
    // Drop the conflict from the queue; user has been notified.
    await removeMutation(m.id);
    return;
  }

  // 4xx (except 408/429) — do not retry; mark as failed.
  if (
    response.status >= 400 &&
    response.status < 500 &&
    response.status !== 408 &&
    response.status !== 429
  ) {
    let message = `Request failed (${response.status}).`;
    try {
      const envelope = (await response.json()) as { error?: { message?: string } };
      if (envelope.error?.message) message = envelope.error.message;
    } catch {
      /* ignore */
    }
    await updateMutation(m.id, { status: 'failed', lastError: message });
    return;
  }

  // 5xx / 408 / 429 — retry with backoff
  const attempts = m.attempts + 1;
  await updateMutation(m.id, {
    status: 'pending',
    attempts,
    lastError: `Server responded ${response.status}`,
    nextAttemptAt: Date.now() + backoffDelay(attempts),
  });
}

export type ConflictCallback = (mutation: PendingMutation, message: string) => void;

let conflictHandler: ConflictCallback | null = null;

export function setConflictHandler(handler: ConflictCallback | null): void {
  conflictHandler = handler;
}

export async function drainQueue(): Promise<void> {
  if (draining) return;
  if (!navigator.onLine) {
    updateSnapshot({ state: 'offline', online: false });
    return;
  }
  draining = true;
  updateSnapshot({ state: 'syncing' });

  try {
    const now = Date.now();
    const all = await listPending();
    const due = all
      .filter(
        (m) =>
          (m.status === 'pending' || m.status === 'in-flight') && m.nextAttemptAt <= now,
      )
      // Replay in original client order to preserve causality
      .sort((a, b) => a.clientTimestamp - b.clientTimestamp);

    let lastError: string | null = null;
    for (const m of due) {
      try {
        await replayOne(m, conflictHandler ?? undefined);
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        // If network died mid-drain, stop and retry later.
        if (!navigator.onLine) break;
      }
    }

    await refreshCounts();
    const remaining = await countPending();
    updateSnapshot({
      state: navigator.onLine ? (remaining > 0 ? 'idle' : 'idle') : 'offline',
      online: navigator.onLine,
      lastError,
      lastSyncAt: Date.now(),
    });
  } finally {
    draining = false;
    notifyQueueChanged();
  }
}

/* ─────────────── Lifecycle ─────────────── */

function onOnline(): void {
  updateSnapshot({ online: true, state: 'idle' });
  void drainQueue();
}

function onOffline(): void {
  updateSnapshot({ online: false, state: 'offline' });
}

let started = false;

export function startSyncService(): () => void {
  if (started) return () => undefined;
  started = true;

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // Periodic retry (every 60s)
  periodicTimer = setInterval(() => {
    if (navigator.onLine) void drainQueue();
  }, 60_000);

  // Initial drain on boot (in case we have leftovers from a previous session)
  void refreshCounts().then(() => {
    if (navigator.onLine) void drainQueue();
  });

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (periodicTimer) clearInterval(periodicTimer);
    periodicTimer = null;
    started = false;
  };
}
