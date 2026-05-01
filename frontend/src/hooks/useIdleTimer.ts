import { useEffect, useRef } from 'react';

interface UseIdleTimerOptions {
  timeoutMs: number;
  onIdle: () => void;
  enabled?: boolean;
}

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'scroll',
];

export function useIdleTimer({ timeoutMs, onIdle, enabled = true }: UseIdleTimerOptions): void {
  const timerRef = useRef<number | null>(null);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        onIdleRef.current();
      }, timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, reset, { passive: true });
    });

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, reset);
      });
    };
  }, [timeoutMs, enabled]);
}
