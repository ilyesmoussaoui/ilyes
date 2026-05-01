import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { RefreshIcon, PlusIcon, TrashIcon } from '../../components/ui/Icon';
import type { SelectOption } from '../../types/ui';
import {
  getCustomReport,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  type CustomReportParams,
  type CustomReportData,
  type ReportTemplate,
  type ReportFilters,
} from './reportsApi';
import { EChart, CHART_COLORS } from './charts/EChart';
import { ReportEmptyState } from './EmptyState';
import { ReportErrorState } from './ErrorState';
import { formatTimestamp } from './reportHelpers';
import { cn } from '../../lib/cn';

interface CustomReportBuilderProps {
  filters: ReportFilters;
}

const AVAILABLE_METRICS = [
  { id: 'attendance_count', label: 'Attendance Count' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'new_members', label: 'New Members' },
  { id: 'active_subscriptions', label: 'Active Subscriptions' },
  { id: 'expenses', label: 'Expenses' },
] as const;

const CHART_TYPES: SelectOption[] = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
];

const MEMBER_TYPES: SelectOption[] = [
  { value: '', label: 'All Members' },
  { value: 'athlete', label: 'Athlete' },
  { value: 'staff', label: 'Staff' },
  { value: 'external', label: 'External' },
];

type ChartType = 'bar' | 'line' | 'pie';

export function CustomReportBuilder({ filters }: CustomReportBuilderProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Local state for selections
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['attendance_count']));
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [memberType, setMemberType] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Generated report data
  const [reportParams, setReportParams] = useState<CustomReportParams | null>(null);

  const { data: reportData, isLoading: reportLoading, error: reportError, refetch: refetchReport } = useQuery<CustomReportData>({
    queryKey: ['reports', 'custom', reportParams],
    queryFn: () => getCustomReport(reportParams!),
    enabled: reportParams !== null,
  });

  // Templates
  const { data: templates } = useQuery<ReportTemplate[]>({
    queryKey: ['reports', 'templates'],
    queryFn: getTemplates,
  });

  const saveMutation = useMutation({
    mutationFn: saveTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
      setShowSaveModal(false);
      setTemplateName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'templates'] });
      setSelectedTemplateId(null);
    },
  });

  const toggleMetric = useCallback((id: string) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    setReportParams({
      metrics: Array.from(selectedMetrics),
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      disciplineId: filters.disciplineId,
      memberType: memberType || undefined,
      groupBy: filters.groupBy,
    });
  }, [selectedMetrics, filters, memberType]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) return;
    saveMutation.mutate({
      name: templateName.trim(),
      config: {
        metrics: Array.from(selectedMetrics),
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        disciplineId: filters.disciplineId,
        memberType: memberType || undefined,
        groupBy: filters.groupBy,
        chartType,
      },
    });
  }, [templateName, selectedMetrics, filters, memberType, chartType, saveMutation]);

  const handleLoadTemplate = useCallback(
    (tmplId: string) => {
      const tmpl = templates?.find((t) => t.id === tmplId);
      if (!tmpl) return;
      setSelectedTemplateId(tmplId);
      setSelectedMetrics(new Set(tmpl.config.metrics));
      setChartType(tmpl.chartType as ChartType);
      setMemberType(tmpl.config.memberType ?? '');
      // Auto-generate
      setReportParams({
        ...tmpl.config,
        dateFrom: filters.dateFrom ?? tmpl.config.dateFrom,
        dateTo: filters.dateTo ?? tmpl.config.dateTo,
      });
    },
    [templates, filters],
  );

  const chartOption = useMemo((): EChartsOption => {
    if (!reportData || reportData.series.length === 0) return {};

    if (chartType === 'pie') {
      // For pie, use first series only
      const series = reportData.series[0];
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
            data: series.data.map((d) => ({ name: d.label, value: d.value })),
            label: { show: false },
            emphasis: { label: { show: true, fontWeight: 'bold' } },
            itemStyle: {
              borderRadius: 6,
              borderColor: '#fff',
              borderWidth: 2,
            },
          },
        ],
      };
    }

    // For bar/line
    const labels = reportData.series[0]?.data.map((d) => d.label) ?? [];
    return {
      tooltip: { trigger: 'axis' },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11, color: '#64748B' },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { fontSize: 11, color: '#64748B' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748B' },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      series: reportData.series.map((s, i) => ({
        name: AVAILABLE_METRICS.find((m) => m.id === s.metric)?.label ?? s.metric,
        type: chartType,
        data: s.data.map((d) => d.value),
        smooth: chartType === 'line',
        lineStyle: chartType === 'line' ? { width: 2.5 } : undefined,
        itemStyle: {
          color: CHART_COLORS[i % CHART_COLORS.length],
          borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : undefined,
        },
        barMaxWidth: chartType === 'bar' ? 36 : undefined,
        areaStyle: chartType === 'line'
          ? {
              color: {
                type: 'linear' as const,
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: `${CHART_COLORS[i % CHART_COLORS.length]}20` },
                  { offset: 1, color: `${CHART_COLORS[i % CHART_COLORS.length]}02` },
                ],
              },
            }
          : undefined,
      })),
    };
  }, [reportData, chartType]);

  const templateOptions: SelectOption[] = useMemo(() => {
    if (!templates || templates.length === 0) {
      return [{ value: '', label: t('common.empty.noData') }];
    }
    return [
      { value: '', label: t('common.actions.select') + '…' },
      ...templates.map((tmpl) => ({ value: tmpl.id, label: tmpl.name })),
    ];
  }, [templates, t]);

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card title={t('reports.custom.title')}>
        <div className="space-y-5">
          {/* Metrics Selection */}
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              {t('reports.custom.selectMetrics')}
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_METRICS.map((metric) => {
                const isSelected = selectedMetrics.has(metric.id);
                return (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => toggleMetric(metric.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      isSelected
                        ? 'border-primary-300 bg-primary-50 text-primary-600'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                    )}
                    aria-pressed={isSelected}
                  >
                    {metric.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart Type + Member Type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t('common.labels.type')}
              options={CHART_TYPES}
              value={chartType}
              onChange={(v) => setChartType(v as ChartType)}
            />
            <Select
              label={t('common.labels.members')}
              options={MEMBER_TYPES}
              value={memberType}
              onChange={setMemberType}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={handleGenerate}
              iconLeft={<RefreshIcon size={16} />}
            >
              {t('reports.custom.generate')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowSaveModal(true)}
              iconLeft={<PlusIcon size={16} />}
              disabled={selectedMetrics.size === 0}
            >
              {t('common.actions.save')}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-48">
                <Select
                  options={templateOptions}
                  value={selectedTemplateId}
                  onChange={handleLoadTemplate}
                  placeholder={t('common.actions.select') + '…'}
                />
              </div>
              {selectedTemplateId && (
                <Button
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(selectedTemplateId)}
                  loading={deleteMutation.isPending}
                  aria-label={t('common.actions.delete')}
                >
                  <TrashIcon size={16} className="text-danger" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      {reportError ? (
        <ReportErrorState onRetry={() => refetchReport()} />
      ) : reportLoading ? (
        <Card title={t('reports.custom.preview')}>
          <EChart option={{}} height={400} loading />
        </Card>
      ) : reportData ? (
        reportData.series.length > 0 ? (
          <>
            <Card title={t('reports.custom.preview')}>
              <EChart option={chartOption} height={400} />
            </Card>
            {reportData.lastUpdated && (
              <p className="text-xs text-neutral-400 text-right print:hidden">
                {t('common.labels.updatedAt')}: {formatTimestamp(reportData.lastUpdated)}
              </p>
            )}
          </>
        ) : (
          <ReportEmptyState message={t('reports.custom.empty')} />
        )
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 py-20">
          <p className="text-sm text-neutral-500">
            {t('reports.custom.empty')}
          </p>
        </div>
      )}

      {/* Save Template Modal */}
      <Modal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title={t('reports.custom.title')}
        description={t('reports.custom.selectMetrics')}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label={t('common.labels.name')}
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t('common.labels.name')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveTemplate}
              loading={saveMutation.isPending}
              disabled={!templateName.trim()}
            >
              {t('common.actions.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
