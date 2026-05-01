import { useEffect, useState } from 'react';
import { applyUpdate, onNeedRefresh, onOfflineReady } from '../lib/offline/registerSW';
import { Icon } from './ui';

/**
 * Non-blocking banner shown when:
 *   - a new service worker is waiting to activate, or
 *   - the app has been cached for offline use for the first time.
 *
 * Renders at the bottom-right of the viewport. Visible only when there's
 * something to report.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const a = onNeedRefresh(() => setNeedRefresh(true));
    const b = onOfflineReady(() => setOfflineReady(true));
    return () => {
      a();
      b();
    };
  }, []);

  if (!needRefresh && !offlineReady) return null;

  const handleReload = async () => {
    setApplying(true);
    try {
      await applyUpdate();
    } finally {
      setApplying(false);
    }
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-elevation-3 print:hidden"
    >
      <div className="flex items-start gap-3">
        <div
          className={
            needRefresh
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600'
              : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg'
          }
          aria-hidden
        >
          <Icon name={needRefresh ? 'download' : 'check'} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">
            {needRefresh ? 'New version available' : 'Ready for offline use'}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {needRefresh
              ? 'Reload to activate the latest version.'
              : 'This app will keep working if you go offline.'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {needRefresh && (
              <button
                type="button"
                onClick={handleReload}
                disabled={applying}
                className="inline-flex h-8 items-center rounded-md bg-primary-600 px-3 text-xs font-semibold text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
              >
                {applying ? 'Reloading...' : 'Reload now'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
