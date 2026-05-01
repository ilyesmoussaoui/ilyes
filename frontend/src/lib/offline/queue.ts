import { getOfflineDb, type MutationKind, type PendingMutation, type MutationStatus } from './db';

/**
 * Generates a short, collision-resistant idempotency key.
 * Not ULID — just enough uniqueness for per-device offline queue entries.
 */
function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export interface EnqueueInput {
  kind: MutationKind;
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: unknown;
  label: string;
}

export async function enqueueMutation(input: EnqueueInput): Promise<PendingMutation> {
  const now = Date.now();
  const mutation: PendingMutation = {
    id: newId('m'),
    kind: input.kind,
    path: input.path,
    method: input.method,
    body: input.body,
    clientTimestamp: now,
    idempotencyKey: newId('idem'),
    attempts: 0,
    nextAttemptAt: now,
    status: 'pending',
    label: input.label,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getOfflineDb();
  await db.put('pending_mutations', mutation);
  notifyQueueChanged();
  return mutation;
}

export async function listPending(): Promise<PendingMutation[]> {
  const db = await getOfflineDb();
  const all = await db.getAllFromIndex('pending_mutations', 'by_createdAt');
  return all;
}

export async function countPending(): Promise<number> {
  const db = await getOfflineDb();
  return db.count('pending_mutations');
}

export async function countByStatus(status: MutationStatus): Promise<number> {
  const db = await getOfflineDb();
  return db.countFromIndex('pending_mutations', 'by_status', status);
}

export async function updateMutation(
  id: string,
  patch: Partial<Omit<PendingMutation, 'id'>>,
): Promise<void> {
  const db = await getOfflineDb();
  const existing = await db.get('pending_mutations', id);
  if (!existing) return;
  const next: PendingMutation = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put('pending_mutations', next);
  notifyQueueChanged();
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('pending_mutations', id);
  notifyQueueChanged();
}

export async function clearAll(): Promise<void> {
  const db = await getOfflineDb();
  await db.clear('pending_mutations');
  notifyQueueChanged();
}

/* ─────────────── Event bus for UI subscribers ─────────────── */

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyQueueChanged(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // ignore subscriber errors
    }
  }
}
