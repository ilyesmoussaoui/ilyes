import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { UsersIcon, FileTextIcon, CheckIcon, PhoneIcon, DownloadIcon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui';
import type { TableColumn } from '../../types/ui';
import { getMissingDocuments, type ReportFilters, type MissingDocumentsMember } from './reportsApi';
import { MetricCard } from './MetricCard';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { formatNumber, formatPercent, formatDate, formatTimestamp } from './reportHelpers';
import { downloadCsv } from './csvExport';
import { cn } from '../../lib/cn';

interface MissingDocumentsReportProps {
  filters: ReportFilters;
}

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-success-bg text-success',
  inactive: 'bg-neutral-100 text-neutral-600',
  suspended: 'bg-warning-bg text-warning-fg',
  expired: 'bg-danger-bg text-danger',
};

const CSV_HEADERS = ['Nom', 'Téléphone', 'Type', 'Statut', 'Documents manquants', 'Inscrit le'];

export function MissingDocumentsReport({ filters: _filters }: MissingDocumentsReportProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'missing-documents'],
    queryFn: () => getMissingDocuments(),
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
      m.status,
      m.missingTypes.join(', '),
      formatDate(m.createdAt),
    ] as (string | number | null)[]);
    downloadCsv(CSV_HEADERS, rows, 'documents_manquants');
    toast.show({ type: 'success', title: t('reports.export.label'), description: `${rows.length}` });
  }, [data, toast, t]);

  const barOption = useMemo((): EChartsOption => {
    if (!data) return {};
    const sorted = [...data.byType].sort((a, b) => b.missingCount - a.missingCount);
    return {
      tooltip: { trigger: 'axis', formatter: (params: unknown) => {
        const items = params as Array<{ name: string; value: number }>;
        return `${items[0]?.name}<br/>Manquants : ${items[0]?.value}`;
      }},
      xAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#64748B' }, splitLine: { lineStyle: { color: '#F1F5F9' } } },
      yAxis: {
        type: 'category',
        data: sorted.map((d) => d.type),
        axisLabel: { fontSize: 11, color: '#64748B', width: 140, overflow: 'truncate' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      series: [{
        type: 'bar',
        data: sorted.map((d, i) => ({
          value: d.missingCount,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] },
        })),
        barMaxWidth: 24,
        label: { show: true, position: 'right', fontSize: 11, color: '#64748B' },
      }],
    };
  }, [data]);

  const tableColumns: TableColumn<MissingDocumentsMember>[] = useMemo(
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
        key: 'status', header: t('common.labels.status'),
        accessor: (r) => (
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_CLASSES[r.status.toLowerCase()] ?? 'bg-neutral-100 text-neutral-600')}>
            {r.status}
          </span>
        ),
      },
      {
        key: 'missingTypes', header: t('reports.missingDocuments.columns.missing'),
        accessor: (r) => (
          <div className="flex flex-wrap gap-1">
            {r.missingTypes.map((tt) => (
              <span key={tt} className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                {tt}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: 'createdAt', header: t('common.labels.createdAt'),
        accessor: (r) => formatDate(r.createdAt),
        sortable: true,
      },
    ],
    [t],
  );

  if (error) return <ReportErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t('common.labels.members')}
          value={data ? formatNumber(data.summary.totalMembers) : '---'}
          icon={<UsersIcon size={18} />}
          accentColor="primary"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.missingDocuments.columns.missing')}
          value={data ? formatNumber(data.summary.membersWithMissing) : '---'}
          icon={<FileTextIcon size={18} />}
          accentColor="danger"
          loading={isLoading}
        />
        <MetricCard
          title={t('reports.documents.kpis.valid')}
          value={data ? formatPercent(data.summary.compliancePct) : '---'}
          icon={<CheckIcon size={18} />}
          accentColor={data && data.summary.compliancePct >= 80 ? 'success' : 'warning'}
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <Card title={t('reports.missingDocuments.title')}><EChart option={{}} height={300} loading /></Card>
      ) : !hasData ? (
        <ReportEmptyState message={t('reports.missingDocuments.empty')} />
      ) : (
        <>
          <Card title={t('reports.missingDocuments.title')}>
            <EChart option={barOption} height={Math.max(200, (data?.byType.length ?? 0) * 36 + 60)} />
          </Card>

          <Card
            title={t('reports.missingDocuments.title')}
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
            <Table<MissingDocumentsMember>
              columns={tableColumns}
              data={data?.members ?? []}
              getRowId={(r) => r.memberId}
              loading={isLoading}
              emptyTitle={t('reports.missingDocuments.empty')}
              emptyMessage={t('reports.missingDocuments.empty')}
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
