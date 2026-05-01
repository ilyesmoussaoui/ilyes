import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { UsersIcon, CheckIcon, PlusIcon, BarChart3Icon } from '../../components/ui/Icon';
import type { TableColumn } from '../../types/ui';
import { getMembershipReport, type ReportFilters, type MembershipReportData } from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { ExportDropdown } from './ExportDropdown';
import { formatNumber, formatPercent, formatDZD, formatTimestamp } from './reportHelpers';

interface MembershipReportProps {
  filters: ReportFilters;
}

interface PlanRow {
  planType: string;
  count: number;
  revenue: number;
}

export function MembershipReport({ filters }: MembershipReportProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useQuery<MembershipReportData>({
    queryKey: ['reports', 'membership', filters],
    queryFn: () => getMembershipReport(filters),
  });

  const hasData = data && (data.growthTimeSeries.length > 0 || data.byStatus.length > 0);

  const lineOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11, color: '#64748B' },
      },
      xAxis: {
        type: 'category',
        data: data.growthTimeSeries.map((d) => d.date),
        axisLabel: { fontSize: 11, color: '#64748B' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'New Members',
          axisLabel: { fontSize: 11, color: '#64748B' },
          splitLine: { lineStyle: { color: '#F1F5F9' } },
        },
        {
          type: 'value',
          name: 'Total Active',
          axisLabel: { fontSize: 11, color: '#64748B' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'New Members',
          type: 'bar',
          data: data.growthTimeSeries.map((d) => d.newMembers),
          barMaxWidth: 32,
          itemStyle: {
            color: CHART_COLORS[0],
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: 'Total Active',
          type: 'line',
          yAxisIndex: 1,
          data: data.growthTimeSeries.map((d) => d.totalActive),
          smooth: true,
          lineStyle: { width: 2.5 },
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
      ],
    };
  }, [data]);

  const pieOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const statusColors: Record<string, string> = {
      active: '#16A34A',
      inactive: '#94A3B8',
      suspended: '#D97706',
      expired: '#DC2626',
      frozen: '#0284C7',
    };
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
          data: data.byStatus.map((d) => ({
            name: d.status,
            value: d.count,
            itemStyle: { color: statusColors[d.status.toLowerCase()] ?? undefined },
          })),
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

  const agePieOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const AGE_LABELS: Record<string, string> = {
      under_12: 'Moins de 12',
      '12_17': '12-17',
      '18_24': '18-24',
      '25_34': '25-34',
      '35_49': '35-49',
      '50_64': '50-64',
      '65_plus': '65+',
      unknown: 'Inconnu',
    };
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: '#64748B' } },
      series: [{
        type: 'pie',
        radius: ['38%', '68%'],
        center: ['50%', '44%'],
        data: data.byAge.map((d, i) => ({
          name: AGE_LABELS[d.bucket] ?? d.bucket,
          value: d.count,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        })),
        label: { show: false },
        emphasis: { label: { show: true, fontWeight: 'bold' } },
      }],
    };
  }, [data]);

  const genderPieOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const GENDER_LABELS: Record<string, string> = {
      male: 'Hommes',
      female: 'Femmes',
      other: 'Autre',
      unknown: 'Inconnu',
    };
    const GENDER_COLORS: Record<string, string> = {
      male: CHART_COLORS[0],
      female: '#E879F9',
      other: CHART_COLORS[2],
      unknown: CHART_COLORS[7],
    };
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: '#64748B' } },
      series: [{
        type: 'pie',
        radius: ['38%', '68%'],
        center: ['50%', '44%'],
        data: data.byGender.map((d) => ({
          name: GENDER_LABELS[d.gender.toLowerCase()] ?? d.gender,
          value: d.count,
          itemStyle: { color: GENDER_COLORS[d.gender.toLowerCase()] ?? CHART_COLORS[8], borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        })),
        label: { show: false },
        emphasis: { label: { show: true, fontWeight: 'bold' } },
      }],
    };
  }, [data]);

  const barOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{ name: string; value: number; marker: string }>;
          const item = items[0];
          const planData = data.subscriptionsByPlan.find((p) => p.planType === item.name);
          return `<strong>${item.name}</strong><br/>${item.marker} Count: ${item.value}<br/>Revenue: ${formatDZD(planData?.revenue ?? 0)}`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.subscriptionsByPlan.map((d) => d.planType),
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
          name: 'Subscribers',
          type: 'bar',
          data: data.subscriptionsByPlan.map((d) => d.count),
          barMaxWidth: 40,
          itemStyle: {
            color: CHART_COLORS[4],
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [data]);

  const tableColumns: TableColumn<PlanRow>[] = useMemo(
    () => [
      { key: 'planType', header: t('common.labels.type'), accessor: (r) => r.planType, sortable: true },
      {
        key: 'count',
        header: t('common.labels.members'),
        accessor: (r) => formatNumber(r.count),
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
          title={t('common.labels.members')}
          value={data ? formatNumber(data.summary.totalMembers) : '---'}
          icon={<UsersIcon size={18} />}
          accentColor="primary"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.membership.kpis.active')}
          value={data ? formatNumber(data.summary.activeMembers) : '---'}
          icon={<CheckIcon size={18} />}
          accentColor="success"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.membership.kpis.newMembers')}
          value={data ? formatNumber(data.summary.newMembersInRange) : '---'}
          subtitle={data ? formatNumber(data.summary.expiringSubscriptions) : undefined}
          icon={<PlusIcon size={18} />}
          accentColor="info"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.membership.kpis.retention')}
          value={data ? formatPercent(data.summary.activeRatio) : '---'}
          icon={<BarChart3Icon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t('reports.membership.charts.growth')}><EChart option={{}} height={360} loading /></Card>
          <Card title={t('reports.membership.charts.byStatus')}><EChart option={{}} height={360} loading /></Card>
        </div>
      ) : !hasData ? (
        <ReportEmptyState />
      ) : (
        <>
          <Card title={t('reports.membership.charts.growth')}>
            <EChart option={lineOption} height={360} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('reports.membership.charts.byStatus')}>
              <EChart option={pieOption} height={320} />
            </Card>
            <Card title={t('reports.membership.charts.byType')}>
              <EChart option={barOption} height={320} />
            </Card>
          </div>

          {/* Age + Gender breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('reports.membership.charts.ageDistribution')}>
              <EChart option={agePieOption} height={300} />
            </Card>
            <Card title={t('reports.membership.charts.genderDistribution')}>
              <EChart option={genderPieOption} height={300} />
            </Card>
          </div>

          {/* Subscription Plan Table */}
          <Card
            title={t('reports.membership.title')}
            action={
              <ExportDropdown
                reportType="membership"
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
              />
            }
          >
            <Table<PlanRow>
              columns={tableColumns}
              data={data?.subscriptionsByPlan ?? []}
              getRowId={(row) => row.planType}
              loading={isLoading}
              emptyTitle={t('reports.membership.empty')}
              emptyMessage={t('reports.membership.empty')}
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
