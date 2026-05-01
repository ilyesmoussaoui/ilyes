import { useEffect, useRef, useCallback } from 'react';
import { CheckIcon, XIcon } from '../../../components/ui/Icon';

interface ReceptionistControlsProps {
  canAutoCheckIn: boolean;
  countdown: number | null;
  onConfirm: () => void;
  onReject: () => void;
  onCountdownTick: (remaining: number | null) => void;
  disabled?: boolean;
}

export function ReceptionistControls({
  canAutoCheckIn,
  countdown,
  onConfirm,
  onReject,
  onCountdownTick,
  disabled = false,
}: ReceptionistControlsProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onConfirmRef = useRef(onConfirm);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto check-in countdown
  useEffect(() => {
    if (!canAutoCheckIn || disabled) {
      clearTimer();
      return;
    }

    // Start the countdown at 3
    onCountdownTick(3);
    let remaining = 3;

    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearTimer();
        onCountdownTick(null);
        onConfirmRef.current();
      } else {
        onCountdownTick(remaining);
      }
    }, 1000);

    return clearTimer;
  }, [canAutoCheckIn, disabled, clearTimer, onCountdownTick]);

  const handleReject = () => {
    clearTimer();
    onCountdownTick(null);
    onReject();
  };

  const handleConfirm = () => {
    clearTimer();
    onCountdownTick(null);
    onConfirm();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Auto check-in countdown indicator */}
      {canAutoCheckIn && countdown !== null && countdown > 0 && (
        <div className="text-center" role="timer" aria-live="polite">
          <p className="text-lg text-neutral-300">
            Auto check-in in{' '}
            <span className="text-2xl font-bold text-green-400">{countdown}</span>
            {countdown === 1 ? ' second' : ' seconds'}
          </p>
          {/* Countdown progress bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-700">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-1000 ease-linear"
              style={{ width: `${((3 - countdown) / 3) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-green-600 px-8 py-5 text-xl font-bold text-white shadow-lg transition-all hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:opacity-50"
        >
          <CheckIcon size={28} />
          Confirm Check-In
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={disabled}
          className="flex items-center justify-center gap-3 rounded-2xl border-2 border-red-500 px-8 py-5 text-xl font-bold text-red-400 transition-all hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:opacity-50"
        >
          <XIcon size={28} />
          Reject
        </button>
      </div>
    </div>
  );
}
