/**
 * Type shim for the virtual module emitted by `vite-plugin-pwa`.
 *
 * The plugin auto-generates this module at build/dev time with a `registerSW`
 * helper. We load it via `import('virtual:pwa-register')` so the app continues
 * to build in environments where the plugin is disabled.
 */
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onRegistered?: (registration?: ServiceWorkerRegistration) => void;
    onRegisterError?: (error: unknown) => void;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }
  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>;
}
