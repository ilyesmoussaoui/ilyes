import { SpinnerIcon } from '../../../components/ui/Icon';
import { useKioskCamera } from '../hooks/useKioskCamera';
import { CameraDenied } from './CameraDenied';
import { cn } from '../../../lib/cn';

interface CameraFeedProps {
  enabled: boolean;
  isProcessing: boolean;
  onFrame: (imageBase64: string) => void;
  deviceId?: string | null;
}

export function CameraFeed({ enabled, isProcessing, onFrame, deviceId }: CameraFeedProps) {
  const { videoRef, status, error, restart } = useKioskCamera({
    onFrame,
    captureIntervalMs: 3000,
    enabled,
    deviceId,
  });

  if (status === 'denied') {
    return <CameraDenied onRetry={restart} />;
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="flex h-full w-full flex-col items-center justify-center gap-6 p-8"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 text-red-400">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <line x1="5" y1="5" x2="19" y2="19" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Camera Error</h2>
          <p className="mt-2 text-lg text-neutral-400">{error ?? 'Something went wrong.'}</p>
        </div>
        <button
          type="button"
          onClick={restart}
          className="rounded-xl bg-primary-500 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      {status === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 text-neutral-400"
        >
          <SpinnerIcon size={48} className="animate-spin" />
          <span className="text-xl">Starting camera...</span>
        </div>
      )}

      {/* Live video feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          status === 'streaming' ? 'opacity-100' : 'opacity-0',
        )}
        aria-label="Live camera feed for face recognition"
      />

      {/* Scanning overlay - shown when streaming */}
      {status === 'streaming' && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* Corner brackets for face targeting */}
          <div className="absolute left-1/2 top-1/2 h-[280px] w-[220px] -translate-x-1/2 -translate-y-1/2 sm:h-[340px] sm:w-[260px] lg:h-[400px] lg:w-[300px]">
            {/* Top-left corner */}
            <div className="absolute left-0 top-0 h-10 w-10 border-l-[3px] border-t-[3px] border-white/80 rounded-tl-lg" />
            {/* Top-right corner */}
            <div className="absolute right-0 top-0 h-10 w-10 border-r-[3px] border-t-[3px] border-white/80 rounded-tr-lg" />
            {/* Bottom-left corner */}
            <div className="absolute bottom-0 left-0 h-10 w-10 border-b-[3px] border-l-[3px] border-white/80 rounded-bl-lg" />
            {/* Bottom-right corner */}
            <div className="absolute bottom-0 right-0 h-10 w-10 border-b-[3px] border-r-[3px] border-white/80 rounded-br-lg" />
          </div>

          {/* Scanning line animation */}
          <div className="absolute left-1/2 top-1/2 h-[280px] w-[220px] -translate-x-1/2 -translate-y-1/2 overflow-hidden sm:h-[340px] sm:w-[260px] lg:h-[400px] lg:w-[300px]">
            <div
              className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary-400 to-transparent"
              style={{
                animation: 'kiosk-scan 2.5s ease-in-out infinite',
              }}
            />
          </div>

          {/* Processing indicator overlay */}
          {isProcessing && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-5 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-400" />
                <span className="text-sm font-medium text-white">Analyzing...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline keyframes for the scan line */}
      <style>{`
        @keyframes kiosk-scan {
          0%, 100% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 100%; opacity: 1; }
          60% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
