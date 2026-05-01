/**
 * Service worker registration using the PWA plugin's virtual module.
 *
 * The `registerType: 'prompt'` mode means the user explicitly opts-in to
 * refreshing when a new version is waiting. We emit two callbacks the
 * `<UpdatePrompt />` component subscribes to:
 *   - onNeedRefresh: a new SW is waiting to activate
 *   - onOfflineReady: the SW has cached the app shell for offline use
 */

type Callback = () => void;

interface RegisterSWOptions {
  immediate?: boolean;
  onRegistered?: (registration?: ServiceWorkerRegistration) => void;
  onRegisterError?: (error: unknown) => void;
  onNeedRefresh?: Callback;
  onOfflineReady?: Callback;
}

type SWUpdaterFn = (reloadPage?: boolean) => Promise<void>;

let updateSW: SWUpdaterFn | null = null;

const needRefreshListeners = new Set<Callback>();
const offlineReadyListeners = new Set<Callback>();

export function onNeedRefresh(cb: Callback): () => void {
  needRefreshListeners.add(cb);
  return () => {
    needRefreshListeners.delete(cb);
  };
}

export function onOfflineReady(cb: Callback): () => void {
  offlineReadyListeners.add(cb);
  return () => {
    offlineReadyListeners.delete(cb);
  };
}

export async function applyUpdate(): Promise<void> {
  if (updateSW) {
    await updateSW(true);
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    // Dynamic import of vite-plugin-pwa virtual module. The plugin generates
    // this module at build time; in dev (devOptions.enabled=false) it becomes
    // a no-op that resolves to a function which does nothing.
    const mod = (await import('virtual:pwa-register').catch(
      () => null,
    )) as { registerSW?: (opts: RegisterSWOptions) => SWUpdaterFn } | null;

    if (!mod?.registerSW) return;

    updateSW = mod.registerSW({
      immediate: true,
      onNeedRefresh: () => {
        for (const cb of needRefreshListeners) cb();
      },
      onOfflineReady: () => {
        for (const cb of offlineReadyListeners) cb();
      },
      onRegisterError: (err) => {
        // eslint-disable-next-line no-console
        console.warn('[SW] register error:', err);
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SW] unavailable:', err);
  }
}
