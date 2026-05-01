import { UserIcon } from '../../../components/ui/Icon';

export function NoFaceDetected() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-6 py-12 text-center"
    >
      {/* Silhouette icon with pulsing ring */}
      <div className="relative">
        <div className="absolute -inset-3 animate-pulse rounded-full border-2 border-neutral-600" />
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-neutral-800 text-neutral-500">
          <UserIcon size={56} />
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-white">No Face Detected</h2>
        <p className="mt-3 text-xl text-neutral-400">
          Please look directly at the camera
        </p>
      </div>

      {/* Animated dots to indicate waiting */}
      <div className="flex gap-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-500" style={{ animationDelay: '0ms' }} />
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-500" style={{ animationDelay: '200ms' }} />
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-500" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}
