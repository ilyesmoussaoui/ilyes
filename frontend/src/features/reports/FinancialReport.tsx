import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { DollarIcon, BarChart3Icon, CreditCardIcon, AlertIcon } from '../../components/ui/Icon';
import type { TableColumn } from '../../types/ui';
import { getFinancialReport, type ReportFilters, type FinancialReportData } from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { ExportDropdown } from './ExportDropdown';
import { formatDZD, formatTimestamp } from './reportHelpers';

interface FinancialReportProps {
  filters: ReportFilters;
}

interface TopMemberRow {
  memberId: string;
  name: string;
  totalPaid: number;
}

export function FinancialReport({ filters }: FinancialReportProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useQuery<FinancialReportData>({
    queryKey: ['reports', 'financial', filters],
    queryFn: () => getFinancialReport(filters),
  });

  const hasData = data && data.revenueTimeSeries.length > 0;

  const lineOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; marker: string; axisValue?: string }>;
          const axisVal = items[0]?.axisValue ?? '';
          let html = `<strong>${axisVal}</strong><br/>`;
          for (const item of items) {
            html += `${item.marker} ${item.seriesName}: ${formatDZD(item.value)}<br/>`;
          }
          return html;
        },
      },
      legend: {
        top: 0,
        right: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: '#475569' },
      },
      grid: {
        left: 8,
        right: 16,
        top: 40,
        bottom: 24,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.revenueTimeSeries.map((d) => d.date),
        axisLabel: {
          fontSize: 11,
          color: '#64748B',
          hideOverlap: true,
          rotate: data.revenueTimeSeries.length > 12 ? 30 : 0,
          formatter: (value: string) => {
            // Format "2026-04-22" → "Apr 22" for compactness.
            const parts = value.split('-');
            if (parts.length !== 3) return value;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const m = parseInt(parts[1], 10);
            return `${months[m - 1] ?? parts[1]} ${parts[2]}`;
          },
        },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
          color: '#64748B',
          formatter: (val: number) => {
            // Compact currency for axis labels: "12K" / "1.2M" instead of full DZD string
            if (Math.abs(val) >= 1_000_000_00) return `${(val / 1_000_000_00).toFixed(1)}M`;
            if (Math.abs(val) >= 1_000_00) return `${(val / 1_000_00).toFixed(0)}K`;
            return `${(val / 100).toFixed(0)}`;
          },
        },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: [
        {
          name: 'Revenue',
          type: 'line',
          data: data.revenueTimeSeries.map((d) => d.revenue),
          smooth: true,
          lineStyle: { width: 2.5 },
          itemStyle: { color: CHART_COLORS[1] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22, 163, 74, 0.12)' },
                { offset: 1, color: 'rgba(22, 163, 74, 0.01)' },
              ],
            },
          },
        },
        {
          name: 'Expenses',
          type: 'line',
          data: data.revenueTimeSeries.map((d) => d.expenses),
          smooth: true,
          lineStyle: { width: 2.5 },
          itemStyle: { color: CHART_COLORS[3] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(220, 38, 38, 0.08)' },
                { offset: 1, color: 'rgba(220, 38, 38, 0.01)' },
              ],
            },
          },
        },
      ],
    };
  }, [data]);

  const barOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; marker: string; name: string }>;
          const item = items[0];
          const source = data.byPaymentType.find((p) => p.type === item.name);
          return `<strong>${item.name}</strong><br/>${item.marker} Amount: ${formatDZD(item.value)}<br/>Transactions: ${source?.count ?? 0}`;
        },
      },
      grid: { left: 8, right: 16, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.byPaymentType.map((d) => d.type),
        axisLabel: { fontSize: 11, color: '#64748B' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
          color: '#64748B',
          formatter: (val: number) => {
            if (Math.abs(val) >= 1_000_000_00) return `${(val / 1_000_000_00).toFixed(1)}M`;
            if (Math.abs(val) >= 1_000_00) return `${(val / 1_000_00).toFixed(0)}K`;
            return `${(val / 100).toFixed(0)}`;
          },
        },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: [
        {
          name: 'Amount',
          type: 'bar',
          data: data.byPaymentType.map((d) => d.amount),
          barMaxWidth: 40,
          itemStyle: {
            color: CHART_COLORS[0],
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [data]);

  const pieOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number; marker: string };
          return `${p.marker} ${p.name}<br/>Amount: ${formatDZD(p.value)}<br/>Share: ${p.percent}%`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11, color: '#64748B' },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          data: data.byCategory.map((d) => ({ name: d.category, value: d.amount })),
          label: { show: false },
          emphasis: {
            label: { show: true, fontWeight: 'bold' },
          },
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
        },
      ],
    };
  }, [data]);

  const tableColumns: TableColumn<TopMemberRow>[] = useMemo(
    () => [
      { key: 'name', header: t('common.labels.member'), accessor: (r) => r.name, sortable: true },
      {
        key: 'totalPaid',
        header: t('common.labels.paid'),
        accessor: (r) => formatDZD(r.totalPaid),
        sortable: true,
        align: 'right' as const,
      },
    ],
    [t],
  );

  const netIncomeColor = data && data.summary.netIncome >= 0 ? 'success' : 'danger';

  if (error) {
    return <ReportErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('reports.financial.kpis.revenue')}
          value={data ? formatDZD(data.summary.totalRevenue) : '---'}
          icon={<DollarIcon size={18} />}
          accentColor="success"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.financial.kpis.expenses')}
          value={data ? formatDZD(data.summary.totalExpenses) : '---'}
          icon={<CreditCardIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.financial.kpis.netProfit')}
          value={data ? formatDZD(data.summary.netIncome) : '---'}
          icon={<BarChart3Icon size={18} />}
          accentColor={netIncomeColor}
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.financial.kpis.margin')}
          value={data ? formatDZD(data.summary.totalRefunds) : '---'}
          subtitle={data ? `${formatDZD(data.summary.avgTransactionValue)}` : undefined}
          icon={<AlertIcon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      {isLoading ? (
        <Card title={t('reports.financial.charts.revenueByMonth')}><EChart option={{}} height={360} loading /></Card>
      ) : !hasData ? (
        <ReportEmptyState />
      ) : (
        <>
          <Card title={t('reports.financial.charts.revenueByMonth')}>
            <EChart option={lineOption} height={360} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('reports.financial.charts.netProfit')}>
              <EChart option={barOption} height={320} />
            </Card>
            <Card title={t('reports.financial.charts.expensesByCategory')}>
              <EChart option={pieOption} height={320} />
            </Card>
          </div>

          {/* Top Members Table */}
          <Card
            title={t('reports.financial.topMembersByRevenue')}
            action={
              <ExportDropdown
                reportType="financial"
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
              />
            }
          >
            <Table<TopMemberRow>
              columns={tableColumns}
              data={data?.topMembers ?? []}
              getRowId={(row) => row.memberId}
              loading={isLoading}
              emptyTitle={t('reports.financial.empty')}
              emptyMessage={t('reports.financial.empty')}
            />
          </Card>
        </>
      )}

      {/* Footer */}
      {data?.lastUpdated && (
        <p className="text-xs text-neutral-400 text-right print:hidden">
          {t('common.labels.updatedAt')}: {formatTimestamp(data.lastUpdated)}
        </p>
      )}
    </div>
  );
}
