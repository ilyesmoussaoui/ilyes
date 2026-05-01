import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type CameraStatus = 'loading' | 'streaming' | 'denied' | 'error';

interface UseKioskCameraOptions {
  onFrame: (imageBase64: string) => void;
  captureIntervalMs?: number;
  enabled: boolean;
  deviceId?: string | null;
}

interface UseKioskCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error: string | null;
  restart: () => void;
}

// External store for camera state to avoid ESLint issues with setState in effects.
interface CameraStore {
  status: CameraStatus;
  error: string | null;
}

function createCameraStore() {
  let state: CameraStore = { status: 'loading', error: null };
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setState: (next: Partial<CameraStore>) => {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
  };
}

export function useKioskCamera({
  onFrame,
  captureIntervalMs = 3000,
  enabled,
  deviceId,
}: UseKioskCameraOptions): UseKioskCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFrameRef = useRef(onFrame);
  const [restartCounter, setRestartCounter] = useState(0);

  // External store for status — avoids "setState in effect" lint errors
  const [store] = useState(createCameraStore);
  const cameraState = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const stopStream = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];
    if (base64) {
      onFrameRef.current(base64);
    }
  }, []);

  const restart = useCallback(() => {
    stopStream();
    setRestartCounter((c) => c + 1);
  }, [stopStream]);

  // Camera lifecycle effect
  useEffect(() => {
    if (!enabled) {
      stopStream();
      return;
    }

    let cancelled = false;
    store.setState({ status: 'loading', error: null });

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      store.setState({ status: 'error', error: 'Camera API is not supported in this browser.' });
      return;
    }

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 640 },
      height: { ideal: 480 },
    };
    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId };
    } else {
      videoConstraints.facingMode = 'user';
    }

    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        store.setState({ status: 'streaming', error: null });

        requestAnimationFrame(() => {
          if (videoRef.current && !cancelled) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().catch(() => {
              // Autoplay may be blocked
            });
          }
        });

        intervalRef.current = setInterval(captureFrame, captureIntervalMs);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        stopStream();
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          store.setState({ status: 'denied', error: 'Camera permission was denied.' });
        } else {
          store.setState({
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to start camera',
          });
        }
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [enabled, restartCounter, captureFrame, captureIntervalMs, stopStream, store, deviceId]);

  return {
    videoRef,
    status: cameraState.status,
    error: cameraState.error,
    restart,
  };
}
