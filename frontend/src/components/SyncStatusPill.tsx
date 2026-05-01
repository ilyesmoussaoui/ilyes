import { useEffect, useRef, useState } from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { subscribeQueue, listPending } from '../lib/offline/queue';
import { drainQueue } from '../lib/offline/syncService';
import type { PendingMutation } from '../lib/offline/db';
import { cn } from '../lib/cn';
import { Icon } from './ui';

/**
 * Header pill showing sync/offline status.
 *
 * States:
 *   - online, idle, no pending:    "Synced"           (neutral, subtle)
 *   - online, pending:             "Syncing N"        (primary, spinner)
 *   - offline:                     "Offline — N saved" (warning)
 *   - failed/conflict:             "Action needed"    (danger, clickable)
 */
export function SyncStatusPill() {
  const snap = useSyncStatus();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PendingMutation[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const rows = await listPending();
      if (active) setItems(rows);
    };
    void refresh();
    const unsub = subscribeQueue(() => {
      void refresh();
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Derive visual pill
  const total = snap.pending + snap.failed + snap.conflicts;
  const hasIssue = snap.failed > 0 || snap.conflicts > 0;

  let label = 'Synced';
  let tone: 'neutral' | 'primary' | 'warning' | 'danger' = 'neutral';
  let iconName: 'check' | 'refresh' | 'wifi-off' | 'alert' = 'check';

  if (!snap.online) {
    label = total > 0 ? `Offline - ${total} saved` : 'Offline';
    tone = 'warning';
    iconName = 'wifi-off';
  } else if (hasIssue) {
    label = `${snap.failed + snap.conflicts} need${snap.failed + snap.conflicts === 1 ? 's' : ''} attention`;
    tone = 'danger';
    iconName = 'alert';
  } else if (snap.state === 'syncing' || snap.pending > 0) {
    label = `Syncing ${snap.pending}`;
    tone = 'primary';
    iconName = 'refresh';
  }

  const toneClass = {
    neutral: 'text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border-neutral-200',
    primary: 'text-primary-700 bg-primary-50 hover:bg-primary-100 border-primary-200',
    warning: 'text-warning-fg bg-warning-bg hover:bg-warning-bg/80 border-warning/30',
    danger: 'text-danger-fg bg-danger-bg hover:bg-danger-bg/80 border-danger/30',
  }[tone];

  return (
    <div ref={rootRef} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Sync status: ${label}. ${total} pending.`}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          toneClass,
        )}
      >
        <span className={cn('flex h-4 w-4 items-center justify-center', snap.state === 'syncing' && 'animate-spin')}>
          <Icon name={iconName} size={14} />
        </span>
        <span className="hidden sm:inline">{label}</span>
        {total > 0 && (
          <span
            aria-hidden
            className={cn(
              'ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
              tone === 'danger'
                ? 'bg-danger text-white'
                : tone === 'warning'
                  ? 'bg-warning text-white'
                  : tone === 'primary'
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-400 text-white',
            )}
          >
            {total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sync status details"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-3"
        >
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">
              {snap.online ? 'Connection online' : 'You are offline'}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {snap.online
                ? total === 0
                  ? 'All changes are synced with the server.'
                  : `${total} queued change${total === 1 ? '' : 's'} waiting to sync.`
                : 'Changes will be saved locally and synced when connection returns.'}
            </p>
            {snap.lastSyncAt && (
              <p className="mt-1 text-[11px] text-neutral-400">
                Last sync: {new Date(snap.lastSyncAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {items.length > 0 ? (
            <ul className="max-h-60 divide-y divide-neutral-100 overflow-y-auto">
              {items.slice(0, 20).map((m) => (
                <li key={m.id} className="flex items-start gap-2 px-4 py-2 text-xs">
                  <span
                    className={cn(
                      'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                      m.status === 'pending' || m.status === 'in-flight'
                        ? 'bg-primary-500'
                        : m.status === 'conflict'
                          ? 'bg-danger'
                          : 'bg-warning',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-neutral-800">{m.label}</span>
                    {m.lastError && (
                      <span className="block truncate text-danger">{m.lastError}</span>
                    )}
                    <span className="block text-neutral-400">
                      {new Date(m.createdAt).toLocaleTimeString()} · attempts: {m.attempts}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-4 text-center text-xs text-neutral-500">Nothing queued.</div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
              onClick={() => void drainQueue()}
              disabled={!snap.online || snap.state === 'syncing' || total === 0}
            >
              <Icon name="refresh" size={12} />
              Sync now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
