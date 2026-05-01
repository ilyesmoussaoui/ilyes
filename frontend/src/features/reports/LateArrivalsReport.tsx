import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { UsersIcon, ClockIcon, BarChart3Icon, DownloadIcon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui';
import type { TableColumn } from '../../types/ui';
import {
  getLateArrivals,
  type ReportFilters,
  type LateArrivalRecord,
  type LateArrivalBucket,
} from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { formatNumber, formatDate, formatTimestamp } from './reportHelpers';
import { downloadCsv } from './csvExport';

interface LateArrivalsReportProps {
  filters: ReportFilters;
}

const CSV_HEADERS = [
  'Date',
  'Heure arrivée',
  'Heure prévue',
  'Membre',
  'Discipline',
  'Retard (min)',
];

const BUCKET_LABELS: Record<LateArrivalBucket, string> = {
  '0_15': '0-15 min',
  '16_30': '16-30 min',
  '31_60': '31-60 min',
  '60_plus': '60+ min',
};

const BUCKET_ORDER: LateArrivalBucket[] = ['0_15', '16_30', '31_60', '60_plus'];

export function LateArrivalsReport({ filters }: LateArrivalsReportProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(10);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'late-arrivals', filters, gracePeriodMinutes],
    queryFn: () => getLateArrivals({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      gracePeriodMinutes,
    }),
  });

  const sortedRecords = useMemo(() => {
    if (!data) return [];
    return [...data.records].sort((a, b) => b.minutesLate - a.minutesLate);
  }, [data]);

  const hasData = sortedRecords.length > 0;

  const handleExport = useCallback(() => {
    if (sortedRecords.length === 0) {
      toast.show({ type: 'info', title: t('common.empty.noData'), description: t('common.empty.tryDifferentFilter') });
      return;
    }
    const rows = sortedRecords.map((r) => [
      formatDate(r.checkInTime),
      r.checkInTime.slice(11, 16),
      r.scheduledStartTime.slice(0, 5),
      r.memberName,
      r.discipline ?? '',
      r.minutesLate,
    ] as (string | number | null)[]);
    downloadCsv(CSV_HEADERS, rows, 'retards');
    toast.show({ type: 'success', title: t('reports.export.label'), description: `${rows.length}` });
  }, [sortedRecords, toast, t]);

  const byBucketOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const bucketMap = new Map(data.byBucket.map((b) => [b.bucket, b.count]));
    const ordered = BUCKET_ORDER.map((bucket) => ({
      bucket,
      count: bucketMap.get(bucket) ?? 0,
    }));
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ordered.map((b) => BUCKET_LABELS[b.bucket]),
        axisLabel: { fontSize: 11, color: '#64748B' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#64748B' }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      series: [{
        type: 'bar',
        data: ordered.map((b, i) => ({
          value: b.count,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 60,
        label: { show: true, position: 'top', fontSize: 11, color: '#64748B' },
      }],
    };
  }, [data]);

  const topMembersOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const top = data.topLateMembers.slice(0, 20);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const arr = params as { dataIndex: number; name: string; value: number }[];
          const first = arr[0];
          if (!first) return '';
          const m = top[first.dataIndex];
          if (!m) return '';
          return `${m.memberName}<br/>Retards: <b>${m.lateCount}</b><br/>Retard moyen: <b>${m.avgMinutesLate} min</b>`;
        },
      },
      xAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#64748B' }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      yAxis: {
        type: 'category',
        data: top.map((m) => m.memberName),
        axisLabel: { fontSize: 11, color: '#64748B', width: 130, overflow: 'truncate' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      series: [{
        type: 'bar',
        data: top.map((m, i) => ({
          value: m.lateCount,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] },
        })),
        barMaxWidth: 20,
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          color: '#64748B',
          formatter: (p: { dataIndex: number }) => {
            const m = top[p.dataIndex];
            return m ? `${m.lateCount} (${m.avgMinutesLate}m)` : '';
          },
        },
      }],
    };
  }, [data]);

  const tableColumns: TableColumn<LateArrivalRecord>[] = useMemo(
    () => [
      {
        key: 'date', header: t('common.labels.date'),
        accessor: (r) => formatDate(r.checkInTime),
        sortable: true,
      },
      {
        key: 'time', header: t('common.labels.time'),
        accessor: (r) => r.checkInTime.slice(11, 16),
        sortable: true,
      },
      {
        key: 'scheduled', header: t('reports.lateArrivals.threshold'),
        accessor: (r) => (
          <span className="text-neutral-600">{r.scheduledStartTime.slice(0, 5)}</span>
        ),
        sortable: true,
      },
      { key: 'memberName', header: t('common.labels.member'), accessor: (r) => r.memberName, sortable: true },
      {
        key: 'discipline', header: t('common.labels.discipline'),
        accessor: (r) => r.discipline ?? <span className="text-neutral-400">—</span>,
      },
      {
        key: 'minutesLate', header: t('reports.lateArrivals.columns.late'),
        accessor: (r) => (
          <span className="inline-flex items-center gap-0.5 font-semibold text-warning">
            <ClockIcon size={12} />
            {r.minutesLate} min
          </span>
        ),
        align: 'center' as const,
        sortable: true,
      },
    ],
    [t],
  );

  if (error) return <ReportErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      {/* Grace period control */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1">
        <div className="flex items-center gap-1.5 text-neutral-500">
          <ClockIcon size={16} />
          <span className="text-xs font-medium uppercase tracking-wide">Délai de tolérance (minutes)</span>
        </div>
        <div>
          <label htmlFor="late-grace" className="mb-1 block text-xs font-medium text-neutral-600">
            Considéré en retard après (minutes)
          </label>
          <input
            id="late-grace"
            type="number"
            min={0}
            max={120}
            value={gracePeriodMinutes}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 0 && v <= 120) setGracePeriodMinutes(v);
            }}
            className="h-10 w-24 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <p className="text-xs text-neutral-500">
          Arrivées plus de <strong>{gracePeriodMinutes} minutes</strong> après l'heure prévue de la session
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t('reports.lateArrivals.title')}
          value={data ? formatNumber(data.summary.totalLateArrivals) : '---'}
          icon={<BarChart3Icon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.lateArrivals.columns.member')}
          value={data ? formatNumber(data.summary.uniqueMembersLate) : '---'}
          icon={<UsersIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.lateArrivals.columns.late')}
          value={data ? formatNumber(data.summary.avgMinutesLate) : '---'}
          icon={<ClockIcon size={18} />}
          accentColor="info"
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Retards par durée"><EChart option={{}} height={280} loading /></Card>
          <Card title="Top membres en retard"><EChart option={{}} height={280} loading /></Card>
        </div>
      ) : !hasData ? (
        <ReportEmptyState message="Aucun retard — tout le monde était à l'heure !" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Retards par durée">
              <EChart option={byBucketOption} height={280} />
            </Card>
            <Card title="Top 20 membres en retard">
              <EChart option={topMembersOption} height={Math.max(280, (data?.topLateMembers.slice(0, 20).length ?? 0) * 28 + 60)} />
            </Card>
          </div>

          <Card
            title="Historique des retards"
            action={
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-elevation-1 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <DownloadIcon size={13} />
                Exporter CSV
              </button>
            }
          >
            <Table<LateArrivalRecord>
              columns={tableColumns}
              data={sortedRecords}
              getRowId={(r) => r.id}
              loading={isLoading}
              emptyTitle="Aucun retard"
              emptyMessage="Aucune arrivée tardive pour cette période."
            />
          </Card>
        </>
      )}

      {data?.lastUpdated && (
        <p className="text-right text-xs text-neutral-400 print:hidden">
          Mis à jour : {formatTimestamp(data.lastUpdated)}
        </p>
      )}
    </div>
  );
}
