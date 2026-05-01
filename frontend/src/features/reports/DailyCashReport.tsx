import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { DollarIcon, TrendingUpIcon, TrendingDownIcon, BarChart3Icon, CalendarIcon, DownloadIcon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui';
import type { TableColumn } from '../../types/ui';
import { getDailyCashReport, type ReportFilters, type DailyCashTransaction } from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { formatDZD, formatTimestamp, formatHour } from './reportHelpers';
import { downloadCsv } from './csvExport';
import { cn } from '../../lib/cn';

interface DailyCashReportProps {
  filters: ReportFilters;
}

const TYPE_LABELS: Record<string, string> = {
  revenue: 'Revenu',
  refund: 'Remboursement',
  expense: 'Dépense',
};

const TYPE_CLASSES: Record<string, string> = {
  revenue: 'bg-success-bg text-success',
  refund: 'bg-warning-bg text-warning-fg',
  expense: 'bg-danger-bg text-danger',
};

const CSV_HEADERS = ['Heure (ISO)', 'Type', 'Libellé', 'Membre', 'Catégorie', 'Montant (DZD)'];

export function DailyCashReport({ filters: _filters }: DailyCashReportProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0] as string;
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'daily-cash', selectedDate],
    queryFn: () => getDailyCashReport({ date: selectedDate }),
  });

  const hasData = data && (data.transactions.length > 0 || data.hourly.some((h) => h.revenue > 0 || h.expenses > 0));

  const handleExport = useCallback(() => {
    const transactions = data?.transactions ?? [];
    if (transactions.length === 0) {
      toast.show({ type: 'info', title: t('common.empty.noData'), description: t('common.empty.tryDifferentFilter') });
      return;
    }
    const rows = transactions.map((tr) => [
      tr.time,
      tr.type,
      tr.label,
      tr.memberName ?? '',
      tr.category,
      (tr.amount / 100).toFixed(2),
    ] as (string | number | null)[]);
    downloadCsv(CSV_HEADERS, rows, `caisse_journaliere_${selectedDate}`);
    toast.show({ type: 'success', title: t('reports.export.label'), description: `${rows.length}` });
  }, [data, selectedDate, toast, t]);

  const hourlyOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const hours = data.hourly.map((h) => formatHour(h.hour));
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: '#64748B' } },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { fontSize: 10, color: '#64748B', interval: 2 },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#64748B' }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      series: [
        {
          name: 'Revenus',
          type: 'line',
          data: data.hourly.map((h) => h.revenue),
          smooth: true,
          lineStyle: { width: 2.5 },
          itemStyle: { color: CHART_COLORS[1] },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(22,163,74,0.12)' }, { offset: 1, color: 'rgba(22,163,74,0.01)' }] } },
        },
        {
          name: 'Dépenses',
          type: 'line',
          data: data.hourly.map((h) => h.expenses),
          smooth: true,
          lineStyle: { width: 2.5 },
          itemStyle: { color: CHART_COLORS[3] },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(220,38,38,0.10)' }, { offset: 1, color: 'rgba(220,38,38,0.01)' }] } },
        },
        {
          name: 'Net',
          type: 'line',
          data: data.hourly.map((h) => h.net),
          smooth: true,
          lineStyle: { width: 2, type: 'dashed' },
          itemStyle: { color: CHART_COLORS[0] },
        },
      ],
    };
  }, [data]);

  const byPaymentOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.byPaymentType.map((d) => d.type),
        axisLabel: { fontSize: 11, color: '#64748B', rotate: data.byPaymentType.length > 5 ? 20 : 0 },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#64748B' }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      series: [{
        type: 'bar',
        data: data.byPaymentType.map((d, i) => ({
          value: d.amount,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 40,
      }],
    };
  }, [data]);

  const byExpenseOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#64748B' }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      yAxis: {
        type: 'category',
        data: data.expensesByCategory.map((d) => d.category),
        axisLabel: { fontSize: 11, color: '#64748B' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      series: [{
        type: 'bar',
        data: data.expensesByCategory.map((d, i) => ({
          value: d.amount,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] },
        })),
        barMaxWidth: 20,
      }],
    };
  }, [data]);

  const tableColumns: TableColumn<DailyCashTransaction>[] = useMemo(
    () => [
      {
        key: 'time', header: t('common.labels.time'),
        accessor: (r) => r.time.slice(11, 16),
        sortable: true,
      },
      {
        key: 'type', header: t('common.labels.type'),
        accessor: (r) => (
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TYPE_CLASSES[r.type] ?? 'bg-neutral-100 text-neutral-600')}>
            {TYPE_LABELS[r.type] ?? r.type}
          </span>
        ),
      },
      { key: 'label', header: t('common.labels.description'), accessor: (r) => r.label, sortable: true },
      { key: 'memberName', header: t('common.labels.member'), accessor: (r) => r.memberName ?? <span className="text-neutral-400">—</span> },
      { key: 'category', header: t('common.labels.category'), accessor: (r) => r.category },
      {
        key: 'amount', header: t('common.labels.amount'),
        accessor: (r) => (
          <span className={cn('inline-flex items-center gap-1 font-semibold', r.type === 'expense' || r.type === 'refund' ? 'text-danger' : 'text-success')}>
            {r.type === 'expense' || r.type === 'refund' ? <TrendingDownIcon size={12} /> : <TrendingUpIcon size={12} />}
            {formatDZD(r.amount)}
          </span>
        ),
        align: 'right' as const,
        sortable: true,
      },
    ],
    [t],
  );

  if (error) return <ReportErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="flex items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1">
        <div className="flex items-center gap-1.5 text-neutral-500">
          <CalendarIcon size={16} />
          <span className="text-xs font-medium uppercase tracking-wide">{t('common.labels.date')}</span>
        </div>
        <div>
          <label htmlFor="cash-date" className="mb-1 block text-xs font-medium text-neutral-600">
            {t('reports.dailyCash.date')}
          </label>
          <input
            id="cash-date"
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('reports.financial.kpis.revenue')}
          value={data ? formatDZD(data.summary.totalRevenue) : '---'}
          icon={<TrendingUpIcon size={18} />}
          accentColor="success"
          loading={isLoading}
        />
        <MetricCard
          title={t('payments.status.refunded')}
          value={data ? formatDZD(data.summary.totalRefunds) : '---'}
          icon={<TrendingDownIcon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.financial.kpis.expenses')}
          value={data ? formatDZD(data.summary.totalExpenses) : '---'}
          icon={<DollarIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.dailyCash.net')}
          value={data ? formatDZD(data.summary.netCash) : '---'}
          icon={<BarChart3Icon size={18} />}
          accentColor={data && data.summary.netCash >= 0 ? 'success' : 'danger'}
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t('reports.dailyCash.title')}><EChart option={{}} height={300} loading /></Card>
          <Card title={t('common.labels.paymentMethod')}><EChart option={{}} height={300} loading /></Card>
        </div>
      ) : !hasData ? (
        <ReportEmptyState message={t('reports.dailyCash.empty')} />
      ) : (
        <>
          <Card title={t('reports.dailyCash.title')}>
            <EChart option={hourlyOption} height={300} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('common.labels.paymentMethod')}>
              <EChart option={byPaymentOption} height={280} />
            </Card>
            <Card title={t('reports.financial.charts.expensesByCategory')}>
              <EChart option={byExpenseOption} height={280} />
            </Card>
          </div>

          <Card
            title={t('reports.dailyCash.title')}
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
            <Table<DailyCashTransaction>
              columns={tableColumns}
              data={data?.transactions ?? []}
              getRowId={(r) => r.id}
              loading={isLoading}
              emptyTitle={t('reports.dailyCash.empty')}
              emptyMessage={t('reports.dailyCash.empty')}
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
