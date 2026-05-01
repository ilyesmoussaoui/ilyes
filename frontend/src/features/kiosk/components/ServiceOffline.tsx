/**
 * ServiceOffline — shown in KioskPage when getFaceServiceHealth() fails or returns online:false.
 *
 * Spec (verbatim French):
 *   Title: "Service biométrique indisponible"
 *   Body:  "Veuillez procéder à l'enregistrement manuel."
 *   CTA:   "Mode manuel" → switches to manual mode
 */

interface ServiceOfflineProps {
  onSwitchToManual: () => void;
}

export function ServiceOffline({ onSwitchToManual }: ServiceOfflineProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-6 py-12 text-center"
    >
      {/* Warning icon with red accent */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 text-red-400">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-white">Service biométrique indisponible</h2>
        <p className="mt-3 text-xl text-neutral-400">
          Veuillez procéder à l'enregistrement manuel.
        </p>
      </div>

      <button
        type="button"
        onClick={onSwitchToManual}
        className="rounded-xl bg-red-500 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
      >
        Mode manuel
      </button>
    </div>
  );
}
