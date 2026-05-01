import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import type { ECElementEvent } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { FingerprintIcon, UsersIcon, BarChart3Icon, ClockIcon } from '../../components/ui/Icon';
import type { TableColumn } from '../../types/ui';
import { getAttendanceReport, type ReportFilters } from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { ExportDropdown } from './ExportDropdown';
import { formatNumber, formatHour, formatTimestamp } from './reportHelpers';

interface AttendanceReportProps {
  filters: ReportFilters;
}

interface TimeSeriesRow {
  date: string;
  count: number;
}

export function AttendanceReport({ filters }: AttendanceReportProps) {
  const { t } = useTranslation();
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'attendance', filters],
    queryFn: () => getAttendanceReport(filters),
  });

  const handleBarClick = useCallback((params: ECElementEvent) => {
    if (params.name) {
      setDisciplineFilter((prev) => (prev === params.name ? null : (params.name as string)));
    }
  }, []);

  const hasData = data && data.timeSeries.length > 0;

  const lineOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.timeSeries.map((d) => d.date),
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
          name: 'Check-ins',
          type: 'line',
          data: data.timeSeries.map((d) => d.count),
          smooth: true,
          lineStyle: { width: 2.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37, 99, 235, 0.15)' },
                { offset: 1, color: 'rgba(37, 99, 235, 0.01)' },
              ],
            },
          },
          itemStyle: { color: CHART_COLORS[0] },
        },
      ],
    };
  }, [data]);

  const barOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.byDiscipline.map((d) => d.name),
        axisLabel: { fontSize: 11, color: '#64748B', rotate: data.byDiscipline.length > 6 ? 30 : 0 },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748B' },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: [
        {
          name: 'Check-ins',
          type: 'bar',
          data: data.byDiscipline.map((d) => ({
            value: d.count,
            itemStyle: {
              color: disciplineFilter === d.name ? CHART_COLORS[0] : '#B8D1FF',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 40,
        },
      ],
    };
  }, [data, disciplineFilter]);

  const pieOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11, color: '#64748B' },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          data: data.byMethod.map((d) => ({ name: d.method, value: d.count })),
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

  const heatmapOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => formatHour(i));
    const maxVal = Math.max(1, ...data.byDayHour.map((d) => d.count));

    const heatData: [number, number, number][] = data.byDayHour.map((d) => [
      d.hour,
      d.dayOfWeek,
      d.count,
    ]);

    return {
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number] };
          return `${days[p.value[1]]} ${hours[p.value[0]]}: ${p.value[2]} check-ins`;
        },
      },
      xAxis: {
        type: 'category',
        data: hours,
        splitArea: { show: true },
        axisLabel: { fontSize: 10, color: '#64748B', interval: 2 },
      },
      yAxis: {
        type: 'category',
        data: days,
        splitArea: { show: true },
        axisLabel: { fontSize: 11, color: '#64748B' },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#EEF4FF', '#B8D1FF', '#5A8EFF', '#2563EB', '#1D4ED8'],
        },
        textStyle: { fontSize: 11, color: '#64748B' },
      },
      series: [
        {
          type: 'heatmap',
          data: heatData,
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.2)' },
          },
        },
      ],
    };
  }, [data]);

  const filteredTimeSeries = useMemo(() => {
    if (!data) return [];
    // Filter table data if a discipline is selected (in real app, backend filters)
    return data.timeSeries;
  }, [data]);

  const tableColumns: TableColumn<TimeSeriesRow>[] = useMemo(
    () => [
      { key: 'date', header: t('common.labels.date'), accessor: (r) => r.date, sortable: true },
      {
        key: 'count',
        header: t('reports.attendance.kpis.totalCheckins'),
        accessor: (r) => formatNumber(r.count),
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
          title={t('reports.attendance.kpis.totalCheckins')}
          value={data ? formatNumber(data.summary.totalCheckIns) : '---'}
          icon={<FingerprintIcon size={18} />}
          accentColor="primary"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.attendance.kpis.uniqueMembers')}
          value={data ? formatNumber(data.summary.uniqueMembers) : '---'}
          icon={<UsersIcon size={18} />}
          accentColor="info"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.attendance.kpis.avgPerDay')}
          value={data ? formatNumber(data.summary.avgDailyCheckIns) : '---'}
          icon={<BarChart3Icon size={18} />}
          accentColor="success"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.attendance.kpis.peakHour')}
          value={data ? formatHour(data.summary.peakHour) : '---'}
          subtitle={data?.summary.topDiscipline ? `Top: ${data.summary.topDiscipline}` : undefined}
          icon={<ClockIcon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
      </div>

      {/* Charts row 1 */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t('reports.attendance.charts.dailyTrend')}><EChart option={{}} height={320} loading /></Card>
          <Card title={t('reports.attendance.charts.byDiscipline')}><EChart option={{}} height={320} loading /></Card>
        </div>
      ) : !hasData ? (
        <ReportEmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('reports.attendance.charts.dailyTrend')}>
              <EChart option={lineOption} height={320} />
            </Card>
            <Card
              title={t('reports.attendance.charts.byDiscipline')}
              action={
                disciplineFilter && (
                  <button
                    type="button"
                    onClick={() => setDisciplineFilter(null)}
                    className="text-xs font-medium text-primary-500 hover:text-primary-600"
                  >
                    {t('common.actions.clearFilters')}
                  </button>
                )
              }
            >
              <EChart option={barOption} height={320} onChartClick={handleBarClick} />
            </Card>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('common.labels.method')}>
              <EChart option={pieOption} height={320} />
            </Card>
            <Card title={t('reports.attendance.charts.hourlyHeatmap')}>
              <EChart option={heatmapOption} height={320} />
            </Card>
          </div>

          {/* Data Table */}
          <Card
            title={t('reports.attendance.title')}
            action={
              <ExportDropdown
                reportType="attendance"
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                disciplineId={filters.disciplineId}
              />
            }
          >
            <Table<TimeSeriesRow>
              columns={tableColumns}
              data={filteredTimeSeries}
              getRowId={(row) => row.date}
              loading={isLoading}
              emptyTitle={t('reports.attendance.empty')}
              emptyMessage={t('reports.attendance.empty')}
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
