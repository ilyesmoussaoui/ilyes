import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ClockIcon, SearchIcon, CameraIcon, LogOutIcon } from '../../components/ui/Icon';
import { cn } from '../../lib/cn';
import { useKioskStore } from './kioskStore';
import { matchFace, kioskCheckIn, getFaceServiceHealth } from './kioskApi';
import type { MatchResult } from './kioskApi';
import { ApiError } from '../../lib/api';
import { queueAttendanceCheckIn } from '../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../lib/offline-fallback';
import { useSoundAlerts } from './hooks/useSoundAlerts';
import { CameraFeed } from './components/CameraFeed';
import { MatchResultDisplay } from './components/MatchResult';
import { ManualSearch } from './components/ManualSearch';
import { ServiceOffline } from './components/ServiceOffline';
import { KioskAlerts } from './components/KioskAlerts';
import { CameraPicker } from './components/CameraPicker';

const CAMERA_DEVICE_STORAGE_KEY = 'kiosk.cameraDeviceId';

/* ──────────────────── Clock component ──────────────────── */

function KioskClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-3 text-neutral-400" aria-live="off">
      <ClockIcon size={20} />
      <time dateTime={now.toISOString()} className="tabular-nums">
        <span className="text-base font-semibold text-neutral-200">{timeStr}</span>
        <span className="mx-2 text-neutral-600">|</span>
        <span className="text-sm">{dateStr}</span>
      </time>
    </div>
  );
}

/* ──────────────────── Low-confidence banner ──────────────────── */

interface LowConfidenceBannerProps {
  onSwitchToManual: () => void;
  onDismiss: () => void;
}

function LowConfidenceBanner({ onSwitchToManual, onDismiss }: LowConfidenceBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start justify-between gap-3 rounded-lg border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-red-400"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="font-medium text-red-200">
          Faible niveau de confiance de la reconnaissance faciale – veuillez réessayer ou utiliser
          l'enregistrement manuel.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSwitchToManual}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Mode manuel
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer"
          className="rounded text-red-400 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ──────────────────── Main Kiosk Page ──────────────────── */

export function KioskPage() {
  const {
    mode,
    matchResult,
    isProcessing,
    lastError,
    autoCheckInCountdown,
    faceServiceOnline,
    setMode,
    setMatchResult,
    setProcessing,
    setError,
    setAutoCheckInCountdown,
    setFaceServiceOnline,
    reset,
  } = useKioskStore();

  const { playSuccess, playError } = useSoundAlerts();
  const [noFaceTimeoutKey, setNoFaceTimeoutKey] = useState(0);
  const [noFaceTimeout, setNoFaceTimeout] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Low-confidence banner state
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  // Camera device selection (persisted)
  const [cameraDeviceId, setCameraDeviceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CAMERA_DEVICE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const handleCameraChange = useCallback((id: string | null) => {
    setCameraDeviceId(id);
    try {
      if (id) localStorage.setItem(CAMERA_DEVICE_STORAGE_KEY, id);
      else localStorage.removeItem(CAMERA_DEVICE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const resultDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check face service health on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await getFaceServiceHealth();
        setFaceServiceOnline(health.online);
        if (!health.online && mode === 'camera') {
          setMode('manual');
        }
      } catch {
        setFaceServiceOnline(false);
        if (mode === 'camera') {
          setMode('manual');
        }
      }
    };

    void checkHealth();
    healthPollRef.current = setInterval(() => void checkHealth(), 30000);

    return () => {
      if (healthPollRef.current) clearInterval(healthPollRef.current);
    };
  }, [mode, setFaceServiceOnline, setMode]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      reset();
      if (resultDismissTimerRef.current) clearTimeout(resultDismissTimerRef.current);
    };
  }, [reset]);

  // Derive whether we should run the no-face timer
  const shouldRunNoFaceTimer = mode === 'camera' && !matchResult && !isProcessing;

  // When conditions change such that timer shouldn't run, bump key to reset
  useEffect(() => {
    if (!shouldRunNoFaceTimer) {
      setNoFaceTimeout(false);
      setNoFaceTimeoutKey((k) => k + 1);
    }
  }, [shouldRunNoFaceTimer]);

  // Start "no face detected" timer whenever we are idle
  useEffect(() => {
    if (!shouldRunNoFaceTimer) return;
    const timer = setTimeout(() => setNoFaceTimeout(true), 5000);
    return () => clearTimeout(timer);
    // noFaceTimeoutKey forces reset when conditions toggle
  }, [shouldRunNoFaceTimer, noFaceTimeoutKey]);

  // Handle frame from camera
  const handleFrame = useCallback(
    async (imageBase64: string) => {
      if (isProcessing || matchResult) return;

      setProcessing(true);
      setNoFaceTimeout(false);
      setShowLowConfidence(false);

      try {
        const result: MatchResult = await matchFace(imageBase64);
        setMatchResult(result);
        setProcessing(false);

        if (result.matched) {
          if (result.canAutoCheckIn) {
            playSuccess();
          } else if (result.alreadyCheckedIn || result.subscriptionStatus === 'expired') {
            playError();
          }
          // Auto-dismiss non-actionable results after 5 seconds
          if (result.alreadyCheckedIn || result.subscriptionStatus === 'expired') {
            resultDismissTimerRef.current = setTimeout(() => {
              setMatchResult(null);
            }, 5000);
          }
        } else {
          // Failure
          if (result.reason === 'low_confidence') {
            // Show the French low-confidence banner under the camera
            setShowLowConfidence(true);
            playError();
          } else if (result.reason !== 'no_face') {
            playError();
          }
          resultDismissTimerRef.current = setTimeout(() => {
            setMatchResult(null);
          }, 5000);
        }
      } catch (err) {
        setProcessing(false);
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('La reconnaissance faciale a échoué. Nouvelle tentative…');
        }
        setTimeout(() => setError(null), 3000);
      }
    },
    [isProcessing, matchResult, setProcessing, setMatchResult, setError, playSuccess, playError],
  );

  // Handle check-in confirmation
  const handleConfirmCheckIn = useCallback(async () => {
    if (!matchResult || !matchResult.matched) return;

    setConfirmLoading(true);
    const member = matchResult.member;
    const memberLabel = `${member.firstNameLatin} ${member.lastNameLatin}`.trim();

    const queueOffline = async () => {
      await queueAttendanceCheckIn({
        memberId: member.id,
        memberLabel,
        method: 'face',
      });
      playSuccess();
      resultDismissTimerRef.current = setTimeout(() => {
        setMatchResult(null);
        setConfirmLoading(false);
      }, 5000);
    };

    try {
      if (isOffline()) {
        await queueOffline();
        return;
      }
      await kioskCheckIn({
        member_id: member.id,
        method: 'face',
        confidence: matchResult.confidence,
      });
      playSuccess();
      resultDismissTimerRef.current = setTimeout(() => {
        setMatchResult(null);
        setConfirmLoading(false);
      }, 5000);
    } catch (err) {
      if (shouldFallbackOffline(err)) {
        try {
          await queueOffline();
          return;
        } catch {
          /* fall through to error */
        }
      }
      playError();
      setConfirmLoading(false);
      setError(
        err instanceof ApiError ? err.message : "Échec de l'enregistrement. Veuillez réessayer.",
      );
      setTimeout(() => setError(null), 4000);
    }
  }, [matchResult, playSuccess, playError, setMatchResult, setError]);

  // Handle rejection — dismiss result
  const handleReject = useCallback(() => {
    if (resultDismissTimerRef.current) clearTimeout(resultDismissTimerRef.current);
    setMatchResult(null);
    setAutoCheckInCountdown(null);
  }, [setMatchResult, setAutoCheckInCountdown]);

  // Handle dismiss (try again)
  const handleDismiss = useCallback(() => {
    if (resultDismissTimerRef.current) clearTimeout(resultDismissTimerRef.current);
    setMatchResult(null);
    setAutoCheckInCountdown(null);
    setShowLowConfidence(false);
  }, [setMatchResult, setAutoCheckInCountdown]);

  // Manual search check-in success
  const handleManualCheckInSuccess = useCallback(() => {
    // Already handled in ManualSearch component
  }, []);

  const switchToManual = () => {
    setMode('manual');
    setMatchResult(null);
    setShowLowConfidence(false);
  };

  // Toggle mode
  const toggleMode = () => {
    const newMode = mode === 'camera' ? 'manual' : 'camera';
    setMode(newMode);
    setMatchResult(null);
    setAutoCheckInCountdown(null);
    setError(null);
    setShowLowConfidence(false);
  };

  const isCameraMode = mode === 'camera';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-neutral-900">
      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* LEFT HALF: Camera or Manual Search */}
        <div
          className={cn(
            'relative flex-1 overflow-hidden',
            isCameraMode ? 'bg-black' : 'bg-neutral-900',
          )}
          aria-label={isCameraMode ? 'Zone de caméra' : 'Zone de recherche manuelle'}
        >
          {isCameraMode ? (
            !faceServiceOnline ? (
              <div className="flex h-full items-center justify-center">
                <ServiceOffline onSwitchToManual={switchToManual} />
              </div>
            ) : (
              <div className="relative flex h-full flex-col">
                <CameraFeed
                  enabled={isCameraMode && faceServiceOnline}
                  isProcessing={isProcessing}
                  onFrame={(base64) => void handleFrame(base64)}
                  deviceId={cameraDeviceId}
                />
                {/* Low-confidence banner under camera feed */}
                {showLowConfidence && (
                  <div className="absolute inset-x-4 bottom-4">
                    <LowConfidenceBanner
                      onSwitchToManual={switchToManual}
                      onDismiss={() => {
                        setShowLowConfidence(false);
                        handleDismiss();
                      }}
                    />
                  </div>
                )}
              </div>
            )
          ) : (
            <ManualSearch onCheckInSuccess={handleManualCheckInSuccess} />
          )}
        </div>

        {/* RIGHT HALF: Result area (camera mode only) */}
        {isCameraMode && (
          <div
            className="flex flex-1 flex-col items-center justify-center overflow-y-auto border-t border-neutral-800 p-6 lg:border-l lg:border-t-0 lg:p-10"
            aria-label="Zone de résultat"
          >
            {/* Error alert banner */}
            {lastError && (
              <div className="mb-6 w-full max-w-lg">
                <KioskAlerts
                  type="error"
                  message={lastError}
                  onDismiss={() => setError(null)}
                />
              </div>
            )}

            {/* Result display */}
            <div className="w-full max-w-lg">
              <MatchResultDisplay
                result={matchResult}
                isProcessing={isProcessing}
                noFaceTimeout={noFaceTimeout}
                autoCheckInCountdown={autoCheckInCountdown}
                onConfirmCheckIn={() => void handleConfirmCheckIn()}
                onReject={handleReject}
                onCountdownTick={setAutoCheckInCountdown}
                onDismiss={handleDismiss}
                confirmDisabled={confirmLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <nav
        className="flex shrink-0 items-center justify-between border-t border-neutral-800 bg-neutral-900/95 px-5 py-3 backdrop-blur-sm"
        aria-label="Contrôles du kiosque"
      >
        {/* Left: Clock */}
        <KioskClock />

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          {isCameraMode && (
            <CameraPicker deviceId={cameraDeviceId} onChange={handleCameraChange} />
          )}
          {/* Mode toggle */}
          <button
            type="button"
            onClick={toggleMode}
            className={cn(
              'flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900',
              isCameraMode
                ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                : 'bg-primary-600 text-white hover:bg-primary-500',
            )}
            aria-label={isCameraMode ? 'Passer en recherche manuelle' : 'Passer en mode caméra'}
          >
            {isCameraMode ? (
              <>
                <SearchIcon size={18} />
                <span className="hidden sm:inline">Recherche manuelle</span>
              </>
            ) : (
              <>
                <CameraIcon size={18} />
                <span className="hidden sm:inline">Mode caméra</span>
              </>
            )}
          </button>

          {/* Exit kiosk */}
          <Link
            to="/attendance"
            className="flex items-center gap-2 rounded-xl bg-neutral-800 px-5 py-3 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            aria-label="Quitter le kiosque"
          >
            <LogOutIcon size={18} />
            <span className="hidden sm:inline">Quitter</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
