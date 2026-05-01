import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { UsersIcon, CalendarIcon, ClockIcon, PhoneIcon, DownloadIcon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui';
import type { TableColumn } from '../../types/ui';
import { getAbsences, type ReportFilters, type AbsentMember } from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { formatNumber, formatDate, formatTimestamp } from './reportHelpers';
import { downloadCsv } from './csvExport';

interface AbsencesReportProps {
  filters: ReportFilters;
}

const BUCKET_LABELS: Record<string, string> = {
  never: 'Jamais',
  '15_30': '15-30 j',
  '31_60': '31-60 j',
  '61_90': '61-90 j',
  '90_plus': '+90 j',
};

const CSV_HEADERS = ['Nom', 'Téléphone', 'Type', 'Dernier check-in', 'Jours d\'absence', 'Jamais venu'];

export function AbsencesReport({ filters: _filters }: AbsencesReportProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [threshold, setThreshold] = useState(14);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'absences', threshold],
    queryFn: () => getAbsences({ daysWithoutCheckIn: threshold }),
  });

  const hasData = data && data.members.length > 0;

  const handleExport = useCallback(() => {
    const members = data?.members ?? [];
    if (members.length === 0) {
      toast.show({ type: 'info', title: t('common.empty.noData'), description: t('common.empty.tryDifferentFilter') });
      return;
    }
    const rows = members.map((m) => [
      m.memberName,
      m.phone ?? '',
      m.type,
      m.lastCheckIn ?? '',
      m.daysSinceLastCheckIn ?? '',
      m.neverCheckedIn ? t('common.actions.yes').toLowerCase() : t('common.actions.no').toLowerCase(),
    ] as (string | number | null)[]);
    downloadCsv(CSV_HEADERS, rows, 'absences');
    toast.show({ type: 'success', title: t('reports.export.label'), description: `${rows.length}` });
  }, [data, toast, t]);

  const barOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.byBucket.map((b) => BUCKET_LABELS[b.bucket] ?? b.bucket),
        axisLabel: { fontSize: 11, color: '#64748B' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#64748B' }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      series: [{
        type: 'bar',
        data: data.byBucket.map((b, i) => ({
          value: b.count,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 48,
        label: { show: true, position: 'top', fontSize: 11, color: '#64748B' },
      }],
    };
  }, [data]);

  const tableColumns: TableColumn<AbsentMember>[] = useMemo(
    () => [
      { key: 'memberName', header: t('common.labels.name'), accessor: (r) => r.memberName, sortable: true },
      {
        key: 'phone', header: t('common.labels.phone'),
        accessor: (r) => r.phone ? (
          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
            <PhoneIcon size={12} /> {r.phone}
          </a>
        ) : <span className="text-neutral-400">—</span>,
      },
      {
        key: 'type', header: t('common.labels.type'),
        accessor: (r) => (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
            {r.type}
          </span>
        ),
      },
      {
        key: 'lastCheckIn', header: t('reports.absences.columns.lastVisit'),
        accessor: (r) => r.neverCheckedIn || !r.lastCheckIn
          ? <span className="font-medium text-danger">{BUCKET_LABELS.never}</span>
          : formatDate(r.lastCheckIn),
        sortable: true,
      },
      {
        key: 'daysSince', header: t('reports.absences.columns.daysAgo'),
        accessor: (r) => r.neverCheckedIn
          ? <span className="text-neutral-400">—</span>
          : <span className="font-semibold text-neutral-900">{formatNumber(r.daysSinceLastCheckIn ?? 0)}</span>,
        sortable: true,
        align: 'right' as const,
      },
    ],
    [t],
  );

  if (error) return <ReportErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      {/* Threshold control */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1">
        <div className="flex items-center gap-1.5 text-neutral-500">
          <ClockIcon size={16} />
          <span className="text-xs font-medium uppercase tracking-wide">{t('reports.absences.threshold')}</span>
        </div>
        <div className="flex flex-1 flex-wrap items-end gap-4">
          <div>
            <label htmlFor="absence-threshold" className="mb-1 block text-xs font-medium text-neutral-600">
              {t('reports.absences.daysLabel')}
            </label>
            <input
              id="absence-threshold"
              type="number"
              min={1}
              max={365}
              value={threshold}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) setThreshold(v);
              }}
              className="h-10 w-24 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t('dashboard.sections.inactiveMembers')}
          value={data ? formatNumber(data.summary.inactiveMemberCount) : '---'}
          icon={<UsersIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.absences.threshold')}
          value={data ? `${data.summary.daysWithoutCheckIn} ${t('common.time.days')}` : '---'}
          icon={<ClockIcon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
        <MetricCard
          title={t('common.labels.date')}
          value={data ? formatDate(data.summary.cutoffDate) : '---'}
          icon={<CalendarIcon size={18} />}
          accentColor="info"
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <Card title={t('reports.absences.title')}><EChart option={{}} height={280} loading /></Card>
      ) : !hasData ? (
        <ReportEmptyState message={t('reports.absences.empty')} />
      ) : (
        <>
          <Card title={t('reports.absences.title')}>
            <EChart option={barOption} height={280} />
          </Card>

          <Card
            title={t('dashboard.sections.absentToday')}
            action={
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-elevation-1 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <DownloadIcon size={13} />
                {t('reports.export.csv')}
              </button>
            }
          >
            <Table<AbsentMember>
              columns={tableColumns}
              data={data?.members ?? []}
              getRowId={(r) => r.memberId}
              loading={isLoading}
              emptyTitle={t('reports.absences.empty')}
              emptyMessage={t('reports.absences.empty')}
            />
          </Card>
        </>
      )}

      {data?.lastUpdated && (
        <p className="text-right text-xs text-neutral-400 print:hidden">
          {t('common.labels.updatedAt')}: {formatTimestamp(data.lastUpdated)}
        </p>
      )}
    </div>
  );
}
