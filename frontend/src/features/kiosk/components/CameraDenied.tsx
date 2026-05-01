/**
 * CameraDenied — shown in KioskPage when getUserMedia rejects with NotAllowedError.
 *
 * Spec (verbatim French):
 *   Title:  "Autorisez l'accès à la caméra dans votre navigateur"
 *   Steps:
 *     1. Cliquez sur l'icône 🔒 à gauche de l'URL.
 *     2. Sélectionnez "Autorisations du site".
 *     3. Activez la caméra puis rechargez la page.
 *   CTA: "Actualiser"
 */

interface CameraDeniedProps {
  onRetry: () => void;
}

/* ─── Inline SVG icons for each step ─── */

function LockStepIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-neutral-300"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SitePermissionsIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-neutral-300"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
    </svg>
  );
}

function ToggleCameraIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-neutral-300"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
      <line x1="9" y1="10" x2="15" y2="16" strokeWidth="1.5" />
      {/* toggle check overlay */}
      <polyline points="8 13 11 16 16 11" strokeWidth="2" stroke="#22c55e" />
    </svg>
  );
}

const STEPS = [
  {
    number: 1,
    label: 'Cliquez sur l\'icône \uD83D\uDD12 à gauche de l\'URL.',
    icon: <LockStepIcon />,
  },
  {
    number: 2,
    label: 'Sélectionnez "Autorisations du site".',
    icon: <SitePermissionsIcon />,
  },
  {
    number: 3,
    label: 'Activez la caméra puis rechargez la page.',
    icon: <ToggleCameraIcon />,
  },
] as const;

export function CameraDenied({ onRetry }: CameraDeniedProps) {
  return (
    <div
      role="alert"
      className="flex h-full w-full flex-col items-center justify-center gap-8 p-8"
    >
      {/* Camera × icon */}
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        {/* Red X badge */}
        <div
          className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white"
          aria-hidden="true"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">
          Autorisez l'accès à la caméra dans votre navigateur
        </h2>
      </div>

      {/* Three numbered steps */}
      <ol
        className="w-full max-w-sm space-y-4"
        aria-label="Étapes pour autoriser la caméra"
      >
        {STEPS.map(({ number, label, icon }) => (
          <li key={number} className="flex items-center gap-4">
            {/* Step number pill */}
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white"
              aria-hidden="true"
            >
              {number}
            </span>
            {/* Icon */}
            {icon}
            {/* Label */}
            <span className="text-base text-neutral-200">{label}</span>
          </li>
        ))}
      </ol>

      {/* CTA */}
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl bg-primary-500 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
      >
        Actualiser
      </button>
    </div>
  );
}
