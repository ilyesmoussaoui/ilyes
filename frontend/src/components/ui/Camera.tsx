import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Button } from './Button';
import { CameraIcon, AlertIcon } from './Icon';
import { cn } from '../../lib/cn';

export interface CameraProps {
  onSave: (blob: Blob) => void;
  onCancel?: () => void;
  aspect?: number;
  minOutput?: number;
}

type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'streaming'
  | 'captured'
  | 'cropping'
  | 'denied'
  | 'error';

interface CroppedImageResult {
  blob: Blob;
  width: number;
  height: number;
}

async function createCroppedImage(
  imageSrc: string,
  crop: Area,
  minOutput: number,
): Promise<CroppedImageResult> {
  const image = await loadImage(imageSrc);
  const targetSize = Math.max(minOutput, Math.min(crop.width, crop.height));
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetSize,
    targetSize,
  );
  return new Promise<CroppedImageResult>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas export failed'));
          return;
        }
        resolve({ blob, width: targetSize, height: targetSize });
      },
      'image/jpeg',
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load image'));
    img.src = src;
  });
}

export function Camera({ onSave, onCancel, aspect = 1, minOutput = 200 }: CameraProps) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropPoint, setCropPoint] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus('requesting');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('error');
        setError('Camera API is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setStatus('streaming');
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch (err) {
      stopStream();
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
      } else {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to start camera');
      }
    }
  }, [stopStream]);

  const stopCamera = useCallback(() => {
    stopStream();
    setStatus('idle');
  }, [stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        if (capturedUrl) URL.revokeObjectURL(capturedUrl);
        setCapturedUrl(url);
        setStatus('captured');
        stopStream();
      },
      'image/jpeg',
      0.92,
    );
  }, [capturedUrl, stopStream]);

  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCroppedAreaPixels(null);
    setZoom(1);
    setCropPoint({ x: 0, y: 0 });
    void startCamera();
  }, [capturedUrl, startCamera]);

  const enterCrop = useCallback(() => {
    if (!capturedUrl) return;
    setStatus('cropping');
  }, [capturedUrl]);

  const finishCrop = useCallback(async () => {
    if (!capturedUrl || !croppedAreaPixels) return;
    try {
      const result = await createCroppedImage(capturedUrl, croppedAreaPixels, minOutput);
      onSave(result.blob);
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
      setCroppedAreaPixels(null);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to crop image');
    }
  }, [capturedUrl, croppedAreaPixels, minOutput, onSave]);

  const saveWithoutCrop = useCallback(async () => {
    if (!capturedUrl) return;
    try {
      const response = await fetch(capturedUrl);
      const blob = await response.blob();
      onSave(blob);
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save image');
    }
  }, [capturedUrl, onSave]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const box = 'relative mx-auto h-[300px] w-[300px] max-w-full';

  return (
    <div className="flex flex-col items-center gap-4">
      {status === 'idle' && (
        <div
          className={cn(
            box,
            'flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50',
          )}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <CameraIcon size={28} />
          </div>
          <Button onClick={startCamera} variant="primary">
            Start Camera
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}

      {status === 'requesting' && (
        <div
          className={cn(
            box,
            'flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500',
          )}
          role="status"
        >
          Requesting camera permission...
        </div>
      )}

      {status === 'streaming' && (
        <>
          <div
            className={cn(
              box,
              'overflow-hidden rounded-lg border border-neutral-200 bg-black',
            )}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-8 rounded-full border-2 border-white/70"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={capture}>
              Capture
            </Button>
            <Button variant="secondary" onClick={stopCamera}>
              Stop Camera
            </Button>
          </div>
        </>
      )}

      {status === 'captured' && capturedUrl && (
        <>
          <div
            className={cn(
              box,
              'overflow-hidden rounded-lg border border-neutral-200 bg-black',
            )}
          >
            <img
              src={capturedUrl}
              alt="Captured preview"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={retake}>
              Retake
            </Button>
            <Button variant="ghost" onClick={enterCrop}>
              Crop
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void saveWithoutCrop();
              }}
            >
              Save
            </Button>
          </div>
        </>
      )}

      {status === 'cropping' && capturedUrl && (
        <>
          <div
            className={cn(
              box,
              'relative overflow-hidden rounded-lg border border-neutral-200 bg-black',
            )}
          >
            <Cropper
              image={capturedUrl}
              crop={cropPoint}
              zoom={zoom}
              aspect={aspect}
              cropShape="round"
              showGrid={false}
              onCropChange={setCropPoint}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <label className="flex w-full max-w-xs items-center gap-2 text-xs text-neutral-600">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary-500"
              aria-label="Zoom"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStatus('captured')}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void finishCrop();
              }}
            >
              Save crop
            </Button>
          </div>
        </>
      )}

      {status === 'denied' && (
        <div
          role="alert"
          className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-warning bg-warning-bg p-4 text-sm text-warning-fg"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertIcon size={18} />
            Camera permission denied
          </div>
          <ol className="list-inside list-decimal space-y-1 text-xs">
            <li>Click the camera icon in the address bar.</li>
            <li>Select &quot;Always allow&quot; for this site.</li>
            <li>Refresh the page.</li>
          </ol>
          <Button variant="secondary" onClick={startCamera}>
            Try again
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-danger bg-danger-bg p-4 text-sm text-danger-fg"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertIcon size={18} />
            Camera error
          </div>
          <p className="text-xs">{error ?? 'Something went wrong.'}</p>
          <Button variant="secondary" onClick={startCamera}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
