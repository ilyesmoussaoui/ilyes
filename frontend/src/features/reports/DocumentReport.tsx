import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { FileTextIcon, AlertIcon, ClockIcon, CheckIcon } from '../../components/ui/Icon';
import type { TableColumn } from '../../types/ui';
import {
  getDocumentReport,
  type ReportFilters,
  type DocumentReportData,
  type ExpiringDocument,
} from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { ExportDropdown } from './ExportDropdown';
import { formatNumber, formatPercent, formatDate, formatTimestamp } from './reportHelpers';
import { cn } from '../../lib/cn';

interface DocumentReportProps {
  filters: ReportFilters;
}

export function DocumentReport({ filters }: DocumentReportProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useQuery<DocumentReportData>({
    queryKey: ['reports', 'documents', filters],
    queryFn: () => getDocumentReport(filters),
  });

  const hasData = data && (data.byType.length > 0 || data.byStatus.length > 0);

  const stackedBarOption = useMemo((): EChartsOption => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11, color: '#64748B' },
      },
      xAxis: {
        type: 'category',
        data: data.byType.map((d) => d.type),
        axisLabel: {
          fontSize: 11,
          color: '#64748B',
          rotate: data.byType.length > 6 ? 25 : 0,
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
          name: 'Valid',
          type: 'bar',
          stack: 'total',
          data: data.byType.map((d) => d.valid),
          itemStyle: { color: '#16A34A', borderRadius: [0, 0, 0, 0] },
          barMaxWidth: 36,
        },
        {
          name: 'Expired',
          type: 'bar',
          stack: 'total',
          data: data.byType.map((d) => d.expired),
          itemStyle: { color: '#DC2626' },
          barMaxWidth: 36,
        },
        {
          name: 'Pending',
          type: 'bar',
          stack: 'total',
          data: data.byType.map((d) => d.pending),
          itemStyle: { color: '#D97706', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 36,
        },
      ],
    };
  }, [data]);

  const pieOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const statusColors: Record<string, string> = {
      valid: '#16A34A',
      expired: '#DC2626',
      pending: '#D97706',
      missing: '#94A3B8',
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
            itemStyle: { color: statusColors[d.status.toLowerCase()] ?? CHART_COLORS[7] },
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

  const expiryIsNear = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = d.getTime() - now.getTime();
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      return daysDiff <= 14 && daysDiff >= 0;
    } catch {
      return false;
    }
  };

  const isExpired = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      return d < new Date();
    } catch {
      return false;
    }
  };

  const tableColumns: TableColumn<ExpiringDocument>[] = useMemo(
    () => [
      { key: 'memberName', header: t('reports.documents.columns.member'), accessor: (r) => r.memberName, sortable: true },
      { key: 'documentType', header: t('reports.documents.columns.document'), accessor: (r) => r.documentType, sortable: true },
      {
        key: 'expiryDate',
        header: t('reports.documents.columns.expiryDate'),
        accessor: (r) => (
          <span
            className={cn(
              'font-medium',
              isExpired(r.expiryDate)
                ? 'text-danger'
                : expiryIsNear(r.expiryDate)
                  ? 'text-warning'
                  : 'text-neutral-800',
            )}
          >
            {r.expiryDate ? formatDate(r.expiryDate) : '—'}
            {isExpired(r.expiryDate) && (
              <span className="ml-1 inline-flex items-center rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-medium text-danger">
                {t('common.status.expired').toUpperCase()}
              </span>
            )}
          </span>
        ),
        sortable: true,
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
          title={t('reports.documents.title')}
          value={data ? formatNumber(data.summary.totalDocuments) : '---'}
          icon={<FileTextIcon size={18} />}
          accentColor="primary"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.documents.kpis.expired')}
          value={data ? formatNumber(data.summary.expiredCount) : '---'}
          icon={<AlertIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.documents.kpis.expiring')}
          value={data ? formatNumber(data.summary.expiringCount) : '---'}
          icon={<ClockIcon size={18} />}
          accentColor="warning"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.documents.kpis.valid')}
          value={data ? formatPercent(data.summary.complianceRate) : '---'}
          icon={<CheckIcon size={18} />}
          accentColor="success"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={t('reports.documents.columns.document')}><EChart option={{}} height={360} loading /></Card>
          <Card title={t('reports.documents.columns.status')}><EChart option={{}} height={360} loading /></Card>
        </div>
      ) : !hasData ? (
        <ReportEmptyState message={t('reports.documents.empty')} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title={t('reports.documents.columns.document')}>
              <EChart option={stackedBarOption} height={360} />
            </Card>
            <Card title={t('reports.documents.columns.status')}>
              <EChart option={pieOption} height={360} />
            </Card>
          </div>

          {/* Expiring Documents Table */}
          <Card
            title={t('reports.documents.title')}
            action={
              <ExportDropdown
                reportType="documents"
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
              />
            }
          >
            <Table<ExpiringDocument>
              columns={tableColumns}
              data={data?.expiringDocuments ?? []}
              getRowId={(row) => `${row.memberId}-${row.documentType}`}
              loading={isLoading}
              emptyTitle={t('reports.missingDocuments.empty')}
              emptyMessage={t('reports.missingDocuments.empty')}
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
