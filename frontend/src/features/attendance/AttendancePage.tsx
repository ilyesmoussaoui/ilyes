import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ConfirmModal } from '../../components/ui';
import { useToast } from '../../components/ui';
import { ChevronRightIcon, PlusIcon, LogOutIcon } from '../../components/ui/Icon';
import { useAuthStore } from '../auth/authStore';
import { useSocket } from '../../hooks/useSocket';
import { getPresentMembers, massCheckout } from './attendanceApi';
import type { PresentRecord } from './attendanceApi';
import { OfflineBanner } from './components/OfflineBanner';
import { AttendanceStats } from './components/AttendanceStats';
import { SessionSchedule } from './components/SessionSchedule';
import { PresenceGrid } from './components/PresenceGrid';
import { AttendanceLog } from './components/AttendanceLog';
import { CheckInModal } from './components/CheckInModal';

export function AttendancePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canMassCheckout = user?.role === 'admin' || user?.role === 'manager';
  const toast = useToast();
  const queryClient = useQueryClient();
  const { connected, on, off } = useSocket();

  // Browser online status
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setBrowserOnline(true);
    const goOffline = () => setBrowserOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const isOffline = !connected || !browserOnline;

  // UI state
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [massCheckoutOpen, setMassCheckoutOpen] = useState(false);
  const [massCheckoutLoading, setMassCheckoutLoading] = useState(false);

  // Fetch present members
  const {
    data: presentData,
    isLoading: presentLoading,
    isError: presentError,
  } = useQuery({
    queryKey: ['attendance', 'present'],
    queryFn: getPresentMembers,
    refetchInterval: 30_000,
  });

  const presentRecords = presentData?.records ?? [];

  // Handle Socket.IO events for real-time updates
  const handleCheckin = useCallback(
    (data: PresentRecord) => {
      queryClient.setQueryData<{ records: PresentRecord[] }>(
        ['attendance', 'present'],
        (old) => {
          if (!old) return { records: [data] };
          // Avoid duplicates
          const exists = old.records.some((r) => r.id === data.id);
          if (exists) return old;
          return { records: [...old.records, data] };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', 'today'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    [queryClient],
  );

  const handleCheckout = useCallback(
    (data: { id: string }) => {
      queryClient.setQueryData<{ records: PresentRecord[] }>(
        ['attendance', 'present'],
        (old) => {
          if (!old) return { records: [] };
          return { records: old.records.filter((r) => r.id !== data.id) };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', 'today'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    [queryClient],
  );

  const handleMassCheckoutEvent = useCallback(() => {
    queryClient.setQueryData<{ records: PresentRecord[] }>(
      ['attendance', 'present'],
      () => ({ records: [] }),
    );
    void queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', 'today'] });
  }, [queryClient]);

  useEffect(() => {
    on<PresentRecord>('attendance:checkin', handleCheckin);
    on<{ id: string }>('attendance:checkout', handleCheckout);
    on('attendance:mass-checkout', handleMassCheckoutEvent);

    return () => {
      off<PresentRecord>('attendance:checkin', handleCheckin);
      off<{ id: string }>('attendance:checkout', handleCheckout);
      off('attendance:mass-checkout', handleMassCheckoutEvent);
    };
  }, [on, off, handleCheckin, handleCheckout, handleMassCheckoutEvent]);

  // Checkout a single member (from tile popup)
  const handleTileCheckout = useCallback(
    (recordId: string) => {
      queryClient.setQueryData<{ records: PresentRecord[] }>(
        ['attendance', 'present'],
        (old) => {
          if (!old) return { records: [] };
          return { records: old.records.filter((r) => r.id !== recordId) };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', 'today'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    [queryClient],
  );

  // Mass checkout handler
  const handleMassCheckout = async () => {
    setMassCheckoutLoading(true);
    try {
      const result = await massCheckout();
      toast.show({
        type: 'success',
        title: t('attendance.toast.massCheckoutComplete'),
        description: t('attendance.toast.massCheckoutCount', { count: result.count }),
      });
      queryClient.setQueryData<{ records: PresentRecord[] }>(
        ['attendance', 'present'],
        () => ({ records: [] }),
      );
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', 'today'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    } catch {
      toast.show({ type: 'error', title: t('attendance.toast.massCheckoutFailed') });
    } finally {
      setMassCheckoutLoading(false);
      setMassCheckoutOpen(false);
    }
  };

  // After manual check-in
  const handleCheckInSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['attendance', 'present'] });
    void queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', 'today'] });
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Offline Banner */}
      <OfflineBanner visible={isOffline} />

      {/* Breadcrumb */}
      <nav aria-label={t('app.breadcrumb')} className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {t('app.home')}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="font-semibold text-neutral-700">{t('attendance.breadcrumb')}</li>
        </ol>
      </nav>

      {/* Header */}
      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-neutral-900">
              {t('attendance.title')}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {t('attendance.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              iconLeft={<PlusIcon size={16} />}
              onClick={() => setCheckInOpen(true)}
            >
              {t('attendance.manualCheckIn')}
            </Button>
            {canMassCheckout && (
              <Button
                variant="danger"
                iconLeft={<LogOutIcon size={16} />}
                onClick={() => setMassCheckoutOpen(true)}
                disabled={presentRecords.length === 0}
              >
                {t('attendance.massCheckout')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Content: Sidebar + Grid */}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left sidebar: Stats + Sessions */}
        <aside className="w-full shrink-0 lg:w-60" aria-label={t('attendance.stats.title')}>
          <div className="flex flex-col gap-6">
            <AttendanceStats />
            <SessionSchedule />
          </div>
        </aside>

        {/* Presence Grid */}
        <main className="min-w-0 flex-1" aria-label={t('attendance.currentlyPresent', { count: presentRecords.length })}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {t('attendance.currentlyPresent', { count: presentRecords.length })}
          </h2>
          <PresenceGrid
            records={presentRecords}
            loading={presentLoading}
            error={presentError}
            onCheckout={handleTileCheckout}
          />
        </main>
      </div>

      {/* Attendance Log */}
      <div className="mt-8">
        <AttendanceLog />
      </div>

      {/* Modals */}
      <CheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSuccess={handleCheckInSuccess}
      />

      <ConfirmModal
        open={massCheckoutOpen}
        onClose={() => setMassCheckoutOpen(false)}
        onConfirm={() => void handleMassCheckout()}
        title={t('attendance.massCheckoutConfirm.title')}
        message={t('attendance.massCheckoutConfirm.message', { count: presentRecords.length })}
        confirmLabel={t('attendance.massCheckoutConfirm.confirm')}
        cancelLabel={t('attendance.massCheckoutConfirm.cancel')}
        destructive
        loading={massCheckoutLoading}
      />
    </div>
  );
}
