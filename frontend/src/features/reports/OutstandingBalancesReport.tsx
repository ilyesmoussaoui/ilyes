import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { DollarIcon, UsersIcon, BarChart3Icon, PhoneIcon, DownloadIcon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui';
import type { TableColumn } from '../../types/ui';
import {
  getOutstandingBalances,
  type ReportFilters,
  type OutstandingBalanceMember,
} from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { formatNumber, formatDZD, formatDate, formatTimestamp } from './reportHelpers';
import { downloadCsv } from './csvExport';

interface OutstandingBalancesReportProps {
  filters: ReportFilters;
}

const BUCKET_LABELS: Record<string, string> = {
  '0_30': '0-30 j',
  '31_60': '31-60 j',
  '61_90': '61-90 j',
  '90_plus': '+90 j',
};

const CSV_HEADERS = ['Membre', 'Téléphone', 'Total impayé (DZD)', 'Âge (jours)', 'Dernier paiement', 'Paiements'];

export function OutstandingBalancesReport({ filters: _filters }: OutstandingBalancesReportProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'outstanding-balances'],
    queryFn: () => getOutstandingBalances({ sortBy: 'remaining' }),
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
      (m.totalOutstanding / 100).toFixed(2),
      m.ageDays,
      m.lastPaymentAt ?? '',
      m.paymentCount,
    ] as (string | number | null)[]);
    downloadCsv(CSV_HEADERS, rows, 'soldes_impayes');
    toast.show({ type: 'success', title: t('reports.export.label'), description: `${rows.length}` });
  }, [data, toast, t]);

  const donutOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; data: { total: number } };
          return `${p.name}<br/>Membres : ${p.value}<br/>Total : ${formatDZD(p.data.total)}`;
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: '#64748B' } },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          data: data.byAgeBucket.map((b, i) => ({
            name: BUCKET_LABELS[b.bucket] ?? b.bucket,
            value: b.count,
            total: b.total,
            itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          })),
          label: { show: false },
          emphasis: { label: { show: true, fontWeight: 'bold' } },
        },
      ],
    };
  }, [data]);

  const top10Option = useMemo((): EChartsOption => {
    if (!data) return {};
    const top10 = [...data.members]
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 10);
    return {
      tooltip: { trigger: 'axis', formatter: (params: unknown) => {
        const items = params as Array<{ name: string; value: number }>;
        return `${items[0]?.name}<br/>${formatDZD(items[0]?.value ?? 0)}`;
      }},
      xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#64748B', formatter: (v: number) => formatDZD(v) }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      yAxis: {
        type: 'category',
        data: top10.map((m) => m.memberName),
        axisLabel: { fontSize: 11, color: '#64748B', width: 120, overflow: 'truncate' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      series: [{
        type: 'bar',
        data: top10.map((m, i) => ({
          value: m.totalOutstanding,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] },
        })),
        barMaxWidth: 20,
      }],
    };
  }, [data]);

  const tableColumns: TableColumn<OutstandingBalanceMember>[] = useMemo(
    () => [
      { key: 'memberName', header: t('common.labels.member'), accessor: (r) => r.memberName, sortable: true },
      {
        key: 'phone', header: t('common.labels.phone'),
        accessor: (r) => r.phone ? (
          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
            <PhoneIcon size={12} /> {r.phone}
          </a>
        ) : <span className="text-neutral-400">—</span>,
      },
      { key: 'totalOutstanding', header: t('reports.outstandingBalances.totalOutstanding'), accessor: (r) => <span className="font-semibold text-danger">{formatDZD(r.totalOutstanding)}</span>, sortable: true, align: 'right' as const },
      { key: 'ageDays', header: t('reports.outstandingBalances.columns.age'), accessor: (r) => `${r.ageDays} j`, sortable: true, align: 'right' as const },
      { key: 'lastPaymentAt', header: t('reports.outstandingBalances.columns.lastPayment'), accessor: (r) => r.lastPaymentAt ? formatDate(r.lastPaymentAt) : <span className="text-neutral-400">{BUCKET_LABELS['90_plus']}</span>, sortable: true },
      { key: 'paymentCount', header: t('sidebar.menu.payments'), accessor: (r) => formatNumber(r.paymentCount), align: 'right' as const },
    ],
    [t],
  );

  if (error) return <ReportErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t('reports.outstandingBalances.totalOutstanding')}
          value={data ? formatDZD(data.summary.totalOutstanding) : '---'}
          icon={<DollarIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('common.labels.members')}
          value={data ? formatNumber(data.summary.memberCount) : '---'}
          icon={<UsersIcon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
        <MetricCard
          title={t('common.labels.amount')}
          value={data ? formatDZD(data.summary.avgOutstanding) : '---'}
          icon={<BarChart3Icon size={18} />}
          accentColor="info"
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t('reports.outstandingBalances.title')}><EChart option={{}} height={300} loading /></Card>
          <Card title={t('reports.outstandingBalances.title')}><EChart option={{}} height={300} loading /></Card>
        </div>
      ) : !hasData ? (
        <ReportEmptyState message={t('reports.outstandingBalances.empty')} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('reports.outstandingBalances.columns.age')}>
              <EChart option={donutOption} height={300} />
            </Card>
            <Card title={t('reports.outstandingBalances.title')}>
              <EChart option={top10Option} height={300} />
            </Card>
          </div>

          <Card
            title={t('reports.outstandingBalances.title')}
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
            <Table<OutstandingBalanceMember>
              columns={tableColumns}
              data={data?.members ?? []}
              getRowId={(r) => r.memberId}
              loading={isLoading}
              emptyTitle={t('reports.outstandingBalances.empty')}
              emptyMessage={t('reports.outstandingBalances.empty')}
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
