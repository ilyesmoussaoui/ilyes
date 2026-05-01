import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

/**
 * Offline IndexedDB schema.
 *
 * pending_mutations — queued requests waiting to be replayed against the server.
 * cache_meta         — bookkeeping (last sync, in-flight drain marker, etc.).
 */

export type MutationKind =
  | 'attendance.checkin'
  | 'attendance.checkout'
  | 'attendance.massCheckout'
  | 'pos.checkout'
  | 'member.update'
  | 'member.create';

export type MutationStatus = 'pending' | 'in-flight' | 'failed' | 'conflict';

export interface PendingMutation {
  /** ULID-like opaque ID (string) */
  id: string;
  kind: MutationKind;
  /** Relative API path, e.g. '/attendance/checkin' */
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body (structured-clonable) */
  body: unknown;
  /** Client timestamp (ms) for ordering and server reconciliation */
  clientTimestamp: number;
  /** Idempotency key replayed as `X-Idempotency-Key` header on retry */
  idempotencyKey: string;
  /** Number of retry attempts made */
  attempts: number;
  /** Next earliest retry time (ms epoch) */
  nextAttemptAt: number;
  status: MutationStatus;
  /** Last server/network error message, if any */
  lastError?: string;
  /** Friendly label for UI (e.g. "Check-in: Amine Khelifi") */
  label: string;
  createdAt: number;
  updatedAt: number;
}

export interface CacheMetaEntry {
  key: string;
  value: unknown;
  updatedAt: number;
}

interface OfflineDbSchema extends DBSchema {
  pending_mutations: {
    key: string;
    value: PendingMutation;
    indexes: {
      by_status: MutationStatus;
      by_nextAttemptAt: number;
      by_createdAt: number;
    };
  };
  cache_meta: {
    key: string;
    value: CacheMetaEntry;
  };
}

const DB_NAME = 'sport-erp-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDbSchema>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<OfflineDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pending_mutations')) {
          const store = db.createObjectStore('pending_mutations', { keyPath: 'id' });
          store.createIndex('by_status', 'status');
          store.createIndex('by_nextAttemptAt', 'nextAttemptAt');
          store.createIndex('by_createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('cache_meta')) {
          db.createObjectStore('cache_meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getOfflineDb();
  await db.put('cache_meta', { key, value, updatedAt: Date.now() });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getOfflineDb();
  const row = await db.get('cache_meta', key);
  return row?.value as T | undefined;
}
