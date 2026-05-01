import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, Skeleton } from '../../../components/ui';
import { getTodayStats } from '../attendanceApi';

interface StatCardProps {
  label: string;
  value: number;
  accent: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <Card padding="sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} padding="sm">
          <Skeleton variant="text" width="60%" />
          <div className="mt-2">
            <Skeleton variant="text" width="40%" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AttendanceStats() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance', 'stats', 'today'],
    queryFn: getTodayStats,
    refetchInterval: 30_000,
  });

  if (isLoading) return <StatsSkeleton />;

  if (isError || !data) {
    return (
      <Card padding="sm">
        <p className="text-xs text-danger-fg">{t('common.messages.somethingWrong')}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <StatCard label={t('attendance.stats.checkIns')} value={data.totalCheckIns} accent="text-primary-500" />
      <StatCard label={t('attendance.currentlyPresent', { count: data.currentlyPresent })} value={data.currentlyPresent} accent="text-success" />
      <StatCard label={t('attendance.log.columns.checkOut')} value={data.totalCheckOuts} accent="text-neutral-700" />
    </div>
  );
}
