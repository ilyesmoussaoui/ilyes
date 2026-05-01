import { useMemo } from 'react';
import { Card, Badge } from '../../../../components/ui';
import type { MemberProfile } from '../profileTypes';
import type { SectionId } from '../ProfileSidebar';
import { formatMoney, formatDate } from '../profileUtils';

interface OverviewSectionProps {
  profile: MemberProfile;
  onNavigate: (section: SectionId) => void;
}

type HeatmapDay = {
  date: Date;
  status: 'present' | 'absent' | 'no-session' | 'future';
};

export function OverviewSection({ profile, onNavigate }: OverviewSectionProps) {
  const heatmapDays = useMemo<HeatmapDay[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: HeatmapDay[] = [];

    const attendanceDates = new Set(
      profile.recentAttendance
        .filter((a) => a.date)
        .map((a) => a.date.slice(0, 10)),
    );

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;

      let status: HeatmapDay['status'] = 'no-session';
      if (d > today) {
        status = 'future';
      } else if (attendanceDates.has(dateStr)) {
        status = 'present';
      }

      days.push({ date: d, status });
    }
    return days;
  }, [profile.recentAttendance]);

  const lastPayment = profile.payments
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const activeSub = profile.subscriptions.find(
    (s) => s.status.toLowerCase() === 'active',
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Disciplines Card */}
      <Card title="Disciplines" action={
        <button
          type="button"
          onClick={() => onNavigate('disciplines')}
          className="text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
        >
          View all
        </button>
      }>
        {profile.disciplines.length === 0 ? (
          <p className="text-sm text-neutral-500">No disciplines enrolled.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.disciplines.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{d.disciplineName}</p>
                  {d.beltRank && (
                    <p className="text-xs text-neutral-500">Belt: {d.beltRank}</p>
                  )}
                </div>
                <Badge
                  variant={
                    d.status.toLowerCase() === 'active'
                      ? 'active'
                      : d.status.toLowerCase() === 'suspended'
                      ? 'suspended'
                      : 'inactive'
                  }
                  label={d.status}
                />
              </li>
            ))}
            {profile.disciplines.length > 4 && (
              <li className="text-xs text-neutral-400">+{profile.disciplines.length - 4} more</li>
            )}
          </ul>
        )}
      </Card>

      {/* Attendance Heatmap Card */}
      <Card title="Attendance (last 30 days)" action={
        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
        >
          View all
        </button>
      }>
        <div
          role="img"
          aria-label={`Attendance heatmap: ${profile.totalAttendance} sessions attended`}
          className="flex flex-col gap-1"
        >
          {/* 5 rows × 6 cols = 30 days */}
          {Array.from({ length: 5 }, (_, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {Array.from({ length: 6 }, (_, colIdx) => {
                const dayIdx = rowIdx * 6 + colIdx;
                const day = heatmapDays[dayIdx];
                if (!day) return <div key={colIdx} className="h-5 w-5 rounded-sm" />;

                const colorMap: Record<HeatmapDay['status'], string> = {
                  present: 'bg-success border-success/30',
                  absent: 'bg-danger-bg border-danger/20',
                  'no-session': 'bg-neutral-100 border-neutral-200',
                  future: 'bg-neutral-50 border-neutral-100',
                };

                const labelMap: Record<HeatmapDay['status'], string> = {
                  present: 'Present',
                  absent: 'Absent',
                  'no-session': 'No session',
                  future: 'Future',
                };

                return (
                  <div
                    key={colIdx}
                    title={`${day.date.toLocaleDateString('en-GB')}: ${labelMap[day.status]}`}
                    className={`h-5 w-5 rounded-sm border ${colorMap[day.status]}`}
                  />
                );
              })}
            </div>
          ))}
          <p className="mt-1 text-xs text-neutral-500">
            Total sessions: <span className="font-semibold text-neutral-700">{profile.totalAttendance}</span>
          </p>
        </div>
      </Card>

      {/* Billing Summary Card */}
      <Card title="Billing" action={
        <button
          type="button"
          onClick={() => onNavigate('payments')}
          className="text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
        >
          View all
        </button>
      }>
        <dl className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-neutral-500">Balance</dt>
            <dd className={`text-sm font-semibold ${profile.balance > 0 ? 'text-danger-fg' : 'text-success-fg'}`}>
              {formatMoney(profile.balance)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-neutral-500">Last payment</dt>
            <dd className="text-sm font-medium text-neutral-800">
              {lastPayment ? formatDate(lastPayment.date) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-neutral-500">Subscription</dt>
            <dd>
              {activeSub ? (
                <Badge variant="active" label={activeSub.planName} />
              ) : (
                <span className="text-xs text-neutral-400">None</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Documents Status Card */}
      <Card title="Documents" action={
        <button
          type="button"
          onClick={() => onNavigate('documents')}
          className="text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
        >
          View all
        </button>
      }>
        {profile.documents.length === 0 ? (
          <p className="text-sm text-neutral-500">No documents on file.</p>
        ) : (
          <dl className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full bg-success inline-block" aria-hidden />
                Valid
              </dt>
              <dd className="text-sm font-semibold text-success-fg">{profile.documentsStatus.valid}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full bg-danger inline-block" aria-hidden />
                Expired
              </dt>
              <dd className="text-sm font-semibold text-danger-fg">{profile.documentsStatus.expired}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full bg-warning inline-block" aria-hidden />
                Pending
              </dt>
              <dd className="text-sm font-semibold text-warning-fg">{profile.documentsStatus.pending}</dd>
            </div>
          </dl>
        )}
      </Card>
    </div>
  );
}
