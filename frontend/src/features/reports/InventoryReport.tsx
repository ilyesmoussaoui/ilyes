import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { PackageIcon, AlertIcon, DollarIcon, ShoppingCartIcon } from '../../components/ui/Icon';
import type { TableColumn } from '../../types/ui';
import {
  getInventoryReport,
  type ReportFilters,
  type InventoryReportData,
  type InventoryItem,
} from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { ExportDropdown } from './ExportDropdown';
import { formatNumber, formatDZD, formatTimestamp } from './reportHelpers';
import { cn } from '../../lib/cn';

interface InventoryReportProps {
  filters: ReportFilters;
}

/** Threshold for low-stock warning */
const LOW_STOCK_THRESHOLD = 5;

export function InventoryReport({ filters }: InventoryReportProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useQuery<InventoryReportData>({
    queryKey: ['reports', 'inventory', filters],
    queryFn: () => getInventoryReport(filters),
  });

  const hasData = data && data.items.length > 0;

  const barOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const sorted = [...data.items].sort((a, b) => b.currentStock - a.currentStock).slice(0, 15);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{ name: string; value: number; marker: string }>;
          const item = items[0];
          const source = data.items.find((p) => p.name === item.name);
          return `<strong>${item.name}</strong><br/>${item.marker} Stock: ${item.value}<br/>Sold: ${source?.totalSold ?? 0}`;
        },
      },
      xAxis: {
        type: 'category',
        data: sorted.map((d) => d.name),
        axisLabel: {
          fontSize: 11,
          color: '#64748B',
          rotate: sorted.length > 8 ? 30 : 0,
        },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748B' },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: [
        {
          name: 'Current Stock',
          type: 'bar',
          data: sorted.map((d) => ({
            value: d.currentStock,
            itemStyle: {
              color: d.currentStock <= LOW_STOCK_THRESHOLD ? '#DC2626' : CHART_COLORS[0],
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 36,
        },
      ],
    };
  }, [data]);

  const movementOption = useMemo((): EChartsOption => {
    if (!data || data.stockMovements.length === 0) return {};

    // Group movements by date
    const byDate = new Map<string, { adds: number; removes: number }>();
    for (const m of data.stockMovements) {
      const existing = byDate.get(m.date) ?? { adds: 0, removes: 0 };
      if (m.quantityChange > 0) {
        existing.adds += m.quantityChange;
      } else {
        existing.removes += Math.abs(m.quantityChange);
      }
      byDate.set(m.date, existing);
    }

    const dates = Array.from(byDate.keys()).sort();

    return {
      tooltip: { trigger: 'axis' },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11, color: '#64748B' },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 11, color: '#64748B' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748B' },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: [
        {
          name: 'Stock Added',
          type: 'line',
          data: dates.map((d) => byDate.get(d)?.adds ?? 0),
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS[1] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22, 163, 74, 0.1)' },
                { offset: 1, color: 'rgba(22, 163, 74, 0.01)' },
              ],
            },
          },
        },
        {
          name: 'Stock Removed',
          type: 'line',
          data: dates.map((d) => byDate.get(d)?.removes ?? 0),
          smooth: true,
          lineStyle: { width: 2 },
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

  const tableColumns: TableColumn<InventoryItem>[] = useMemo(
    () => [
      { key: 'name', header: 'Item', accessor: (r) => r.name, sortable: true },
      {
        key: 'currentStock',
        header: 'Stock',
        accessor: (r) => (
          <span
            className={cn(
              'font-medium',
              r.currentStock <= LOW_STOCK_THRESHOLD ? 'text-danger' : 'text-neutral-800',
            )}
          >
            {formatNumber(r.currentStock)}
            {r.currentStock <= LOW_STOCK_THRESHOLD && (
              <span className="ml-1 inline-flex items-center rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-medium text-danger">
                LOW
              </span>
            )}
          </span>
        ),
        sortable: true,
        align: 'right' as const,
      },
      {
        key: 'price',
        header: t('common.labels.price'),
        accessor: (r) => formatDZD(r.price),
        sortable: true,
        align: 'right' as const,
      },
      {
        key: 'totalSold',
        header: t('reports.inventory.charts.topSelling'),
        accessor: (r) => formatNumber(r.totalSold),
        sortable: true,
        align: 'right' as const,
      },
      {
        key: 'revenue',
        header: t('reports.financial.kpis.revenue'),
        accessor: (r) => formatDZD(r.revenue),
        sortable: true,
        align: 'right' as const,
      },
    ],
    [t],
  );

  if (error) {
    return <ReportErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('reports.inventory.kpis.itemsInStock')}
          value={data ? formatNumber(data.summary.totalItems) : '---'}
          icon={<PackageIcon size={18} />}
          accentColor="primary"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.inventory.kpis.lowStock')}
          value={data ? formatNumber(data.summary.lowStockCount) : '---'}
          icon={<AlertIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.inventory.kpis.totalValue')}
          value={data ? formatDZD(data.summary.totalStockValue) : '---'}
          icon={<DollarIcon size={18} />}
          accentColor="info"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.inventory.kpis.totalSales')}
          value={data ? formatDZD(data.summary.totalSalesValue) : '---'}
          icon={<ShoppingCartIcon size={18} />}
          accentColor="success"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t('reports.inventory.charts.stockByCategory')}><EChart option={{}} height={360} loading /></Card>
          <Card title={t('reports.inventory.charts.topSelling')}><EChart option={{}} height={360} loading /></Card>
        </div>
      ) : !hasData ? (
        <ReportEmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('reports.inventory.charts.stockByCategory')}>
              <EChart option={barOption} height={360} />
            </Card>
            <Card title={t('reports.inventory.charts.topSelling')}>
              {data && data.stockMovements.length > 0 ? (
                <EChart option={movementOption} height={360} />
              ) : (
                <ReportEmptyState message={t('reports.inventory.empty')} height={360} />
              )}
            </Card>
          </div>

          {/* Inventory Table */}
          <Card
            title={t('reports.inventory.title')}
            action={
              <ExportDropdown
                reportType="inventory"
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
              />
            }
          >
            <Table<InventoryItem>
              columns={tableColumns}
              data={data?.items ?? []}
              getRowId={(row) => row.id}
              loading={isLoading}
              emptyTitle={t('reports.inventory.empty')}
              emptyMessage={t('reports.inventory.empty')}
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

