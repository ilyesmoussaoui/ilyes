import { useCallback, useRef } from 'react';

interface SoundAlerts {
  playSuccess: () => void;
  playError: () => void;
}

export function useSoundAlerts(): SoundAlerts {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (
      frequency: number,
      durationMs: number,
      type: OscillatorType,
      startOffset: number,
      gainValue: number,
    ) => {
      const ctx = getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startOffset);
      gainNode.gain.setValueAtTime(gainValue, ctx.currentTime + startOffset);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + startOffset + durationMs / 1000,
      );

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime + startOffset);
      oscillator.stop(ctx.currentTime + startOffset + durationMs / 1000);
    },
    [getContext],
  );

  const playSuccess = useCallback(() => {
    // Pleasant ascending chime: C5 -> E5 -> G5
    // Frequencies: 523 Hz, 659 Hz, 784 Hz — 100ms each
    playTone(523, 120, 'sine', 0, 0.3);
    playTone(659, 120, 'sine', 0.1, 0.3);
    playTone(784, 180, 'sine', 0.2, 0.3);
  }, [playTone]);

  const playError = useCallback(() => {
    // Two short low beeps: 200 Hz, 150ms each, 100ms gap
    playTone(200, 150, 'square', 0, 0.2);
    playTone(200, 150, 'square', 0.25, 0.2);
  }, [playTone]);

  return { playSuccess, playError };
}
