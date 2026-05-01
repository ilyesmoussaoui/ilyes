import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Select,
  Badge,
  ConfirmModal,
  Skeleton,
} from '../../components/ui';
import { useToast } from '../../components/ui';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  InboxIcon,
  DownloadIcon,
  PaperclipIcon,
  CalendarIcon,
  BarChart3Icon,
  DollarIcon,
} from '../../components/ui/Icon';
import {
  getExpenses,
  getExpensesSummary,
  deleteExpense,
  getReceiptUrl,
  EXPENSE_CATEGORIES,
} from './expensesApi';
import type { ExpenseRecord, ExpenseSummary } from './expensesApi';
import { ExpenseFormModal } from './ExpenseFormModal';
import { formatDZD, formatDate } from '../payments/utils';
import type { BadgeVariant } from '../../types/ui';

type SortKey = 'date' | 'amount' | 'category';
type SortDir = 'asc' | 'desc';

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All Categories' },
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

const CATEGORY_BADGE_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  rent: { variant: 'pending', label: 'Rent' },
  utilities: { variant: 'active', label: 'Utilities' },
  equipment: { variant: 'paid', label: 'Equipment' },
  maintenance: { variant: 'partial', label: 'Maintenance' },
  salaries: { variant: 'expired', label: 'Salaries' },
  insurance: { variant: 'suspended', label: 'Insurance' },
  marketing: { variant: 'active', label: 'Marketing' },
  other: { variant: 'inactive', label: 'Other' },
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  rent: 'bg-amber-500',
  utilities: 'bg-emerald-500',
  equipment: 'bg-sky-500',
  maintenance: 'bg-violet-500',
  salaries: 'bg-rose-500',
  insurance: 'bg-indigo-500',
  marketing: 'bg-teal-500',
  other: 'bg-neutral-400',
};

const PAGE_SIZE = 20;

type DatePreset = 'this-month' | 'last-month' | 'ytd' | 'last-30d' | 'last-90d' | 'all' | 'custom';

/** Returns ISO yyyy-mm-dd for a local date without timezone shift. */
function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case 'this-month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toIsoDate(start), to: toIsoDate(today) };
    }
    case 'last-month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toIsoDate(start), to: toIsoDate(end) };
    }
    case 'ytd': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { from: toIsoDate(start), to: toIsoDate(today) };
    }
    case 'last-30d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { from: toIsoDate(start), to: toIsoDate(today) };
    }
    case 'last-90d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { from: toIsoDate(start), to: toIsoDate(today) };
    }
    case 'all':
    case 'custom':
    default:
      return { from: '', to: '' };
  }
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'last-30d', label: 'Last 30 Days' },
  { id: 'last-90d', label: 'Last 90 Days' },
  { id: 'ytd', label: 'Year to Date' },
  { id: 'all', label: 'All Time' },
];

export function ExpensesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState<DatePreset>('this-month');
  const initialRange = computeRange('this-month');
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    const r = computeRange(p);
    setDateFrom(r.from);
    setDateTo(r.to);
    setPage(1);
  };

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
      category: categoryFilter || undefined,
      sortBy,
      sortOrder: sortDir,
    }),
    [page, dateFrom, dateTo, categoryFilter, sortBy, sortDir],
  );

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
    error: listErr,
  } = useQuery({
    queryKey: ['expenses', queryParams],
    queryFn: () => getExpenses(queryParams),
    placeholderData: (prev) => prev,
  });

  const summaryParams = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo],
  );

  const { data: summary, isLoading: summaryLoading } = useQuery<ExpenseSummary>({
    queryKey: ['expenses-summary', summaryParams],
    queryFn: () => getExpensesSummary(summaryParams),
    placeholderData: (prev) => prev,
  });

  const expenses = listData?.expenses ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortBy === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(key);
        setSortDir('asc');
      }
      setPage(1);
    },
    [sortBy],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteExpense(deleteTarget.id);
      toast.show({
        type: 'success',
        title: 'Expense deleted',
        description: 'The expense record has been removed.',
      });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
    } catch {
      toast.show({
        type: 'error',
        title: 'Delete failed',
        description: 'Could not delete expense. Please try again.',
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleFormSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
  };

  const openEditModal = (expense: ExpenseRecord) => {
    setEditTarget(expense);
    setFormOpen(true);
  };

  const openAddModal = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleExport = useCallback(async () => {
    try {
      // Export all matching rows (up to 1000) using current filters
      const full = await getExpenses({
        ...queryParams,
        page: 1,
        limit: 1000,
      });
      const rows = full.expenses;
      if (rows.length === 0) {
        toast.show({
          type: 'info',
          title: t('common.empty.noData'),
          description: t('common.empty.tryDifferentFilter'),
        });
        return;
      }

      const escape = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const header = [
        'Date',
        'Category',
        'Amount (DZD)',
        'Description',
        'Has Receipt',
        'Created At',
      ];
      const lines = rows.map((r) =>
        [
          r.date.slice(0, 10),
          r.category,
          (r.amount / 100).toFixed(2),
          r.description ?? '',
          r.receiptPath ? 'yes' : 'no',
          r.createdAt.slice(0, 10),
        ]
          .map(escape)
          .join(','),
      );
      const csv = [header.join(','), ...lines].join('\n');

      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `expenses-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.show({
        type: 'success',
        title: 'Export ready',
        description: `${rows.length} expense${rows.length === 1 ? '' : 's'} exported.`,
      });
    } catch {
      toast.show({
        type: 'error',
        title: 'Export failed',
        description: 'Could not export expenses.',
      });
    }
  }, [queryParams, toast]);

  const renderSortHeader = (label: string, key: SortKey) => {
    const isActive = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 transition-colors hover:text-neutral-800"
      >
        {label}
        <span className="flex flex-col">
          <ChevronUpIcon
            size={10}
            className={isActive && sortDir === 'asc' ? 'text-primary-500' : 'text-neutral-300'}
          />
          <ChevronDownIcon
            size={10}
            className={isActive && sortDir === 'desc' ? 'text-primary-500' : 'text-neutral-300'}
          />
        </span>
      </button>
    );
  };

  const getCategoryBadge = (cat: string) =>
    CATEGORY_BADGE_MAP[cat] ?? { variant: 'inactive' as BadgeVariant, label: cat };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Breadcrumb */}
      <nav aria-label={t('app.breadcrumb')} className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {t('app.home')}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="font-semibold text-neutral-700">{t('expenses.breadcrumb')}</li>
        </ol>
      </nav>

      {/* Header */}
      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-neutral-900">
              {t('expenses.title')}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {t('expenses.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              iconLeft={<DownloadIcon size={15} />}
              onClick={() => void handleExport()}
              disabled={listLoading}
            >
              {t('reports.export.csv')}
            </Button>
            <Button
              variant="primary"
              iconLeft={<PlusIcon size={16} />}
              onClick={openAddModal}
            >
              {t('expenses.addExpense')}
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<DollarIcon size={18} />}
          label={t('expenses.totals.total')}
          value={summary ? formatDZD(summary.total) : null}
          hint={summary ? `${summary.count}` : undefined}
          loading={summaryLoading}
          tone="neutral"
        />
        <KpiCard
          icon={<CalendarIcon size={18} />}
          label={t('expenses.totals.thisMonth')}
          value={summary ? formatDZD(summary.currentMonthTotal) : null}
          hint={renderMoMHint(summary)}
          loading={summaryLoading}
          tone={momTone(summary)}
        />
        <KpiCard
          icon={<BarChart3Icon size={18} />}
          label={t('expenses.totals.thisYear')}
          value={summary ? formatDZD(summary.yearToDateTotal) : null}
          hint={summary?.topCategory ? formatCategoryLabel(summary.topCategory.category) : undefined}
          loading={summaryLoading}
          tone="neutral"
        />
        <KpiCard
          icon={<CalendarIcon size={18} />}
          label={t('common.time.day')}
          value={summary ? formatDZD(summary.dailyAverage) : null}
          hint={t('common.time.day')}
          loading={summaryLoading}
          tone="neutral"
        />
      </div>

      {/* Category breakdown */}
      <Card className="mt-4" title={t('common.labels.category')}>
        {summaryLoading && !summary ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} variant="text" height="24px" />
            ))}
          </div>
        ) : !summary || summary.byCategory.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <BarChart3Icon size={22} />
            </div>
            <p className="text-sm font-medium text-neutral-700">{t('expenses.empty')}</p>
            <p className="text-xs text-neutral-500">
              {t('common.empty.tryDifferentFilter')}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {summary.byCategory.map((c) => {
              const pct = summary.total > 0 ? (c.total / summary.total) * 100 : 0;
              const color = CATEGORY_BAR_COLORS[c.category] ?? 'bg-neutral-400';
              return (
                <li key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700">
                      {formatCategoryLabel(c.category)}
                    </span>
                    <span className="text-neutral-500">
                      {formatDZD(c.total)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full ${color} transition-all`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Filters */}
      <Card className="mt-4">
        <div className="flex flex-col gap-4">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                  preset === p.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date / category filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-48">
              <Select
                label={t('common.labels.category')}
                options={CATEGORY_FILTER_OPTIONS}
                value={categoryFilter}
                onChange={(v) => {
                  setCategoryFilter(v);
                  setPage(1);
                }}
                placeholder={t('payments.filters.all')}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-sm font-medium text-neutral-700">{t('common.labels.dateFrom')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPreset('custom');
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                aria-label={t('common.labels.dateFrom')}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-sm font-medium text-neutral-700">{t('common.labels.dateTo')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPreset('custom');
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                aria-label={t('common.labels.dateTo')}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Error State */}
      {listError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger-fg"
        >
          {t('common.messages.somethingWrong')}{' '}
          {listErr instanceof Error ? listErr.message : t('common.messages.tryAgainLater')}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-1">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label={t('expenses.title')}>
            <thead className="bg-neutral-50">
              <tr>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {renderSortHeader(t('expenses.columns.date'), 'date')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {renderSortHeader(t('expenses.columns.category'), 'category')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {renderSortHeader(t('expenses.columns.amount'), 'amount')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('expenses.columns.description')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('common.labels.receipt')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('common.labels.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {Array.from({ length: 6 }, (__, ci) => (
                      <td
                        key={`skeleton-${i}-${ci}`}
                        className="border-b border-neutral-100 px-4 py-3"
                      >
                        <Skeleton variant="text" lines={1} width="80%" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                        <InboxIcon size={28} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">
                          {t('expenses.empty')}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {categoryFilter || dateFrom || dateTo
                            ? t('common.empty.tryDifferentFilter')
                            : t('expenses.addExpense')}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="default"
                        iconLeft={<PlusIcon size={14} />}
                        onClick={openAddModal}
                      >
                        {t('expenses.addExpense')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((expense, idx) => {
                  const badge = getCategoryBadge(expense.category);
                  return (
                    <tr
                      key={expense.id}
                      className={`border-b border-neutral-100 transition-colors hover:bg-neutral-50 ${
                        idx % 2 === 1 ? 'bg-neutral-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDate(expense.date)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant} label={badge.label} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-800">
                        {formatDZD(expense.amount)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-neutral-700">
                        {expense.description || <span className="text-neutral-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {expense.receiptPath ? (
                          <a
                            href={getReceiptUrl(expense.receiptPath)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label={t('common.actions.view')}
                          >
                            <PaperclipIcon size={14} />
                            {t('common.actions.view')}
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(expense)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label={`${t('common.actions.edit')} ${formatDate(expense.date)}`}
                          >
                            <EditIcon size={14} />
                            {t('common.actions.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(expense)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                            aria-label={`${t('common.actions.delete')} ${formatDate(expense.date)}`}
                          >
                            <TrashIcon size={14} />
                            {t('common.actions.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!listLoading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            <span>
              {t('common.pagination.summary', { page, total: totalPages, count: total })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="default"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                iconLeft={<ChevronLeftIcon size={14} />}
              >
                {t('common.actions.previous')}
              </Button>
              <Button
                variant="secondary"
                size="default"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                iconRight={<ChevronRightIcon size={14} />}
              >
                {t('common.actions.next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <ExpenseFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSuccess={handleFormSuccess}
        editExpense={editTarget}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={t('expenses.deleteExpense')}
        message={
          deleteTarget
            ? `${t('expenses.confirmDelete')} ${formatDZD(deleteTarget.amount)} — ${t('common.messages.actionIrreversible')}`
            : ''
        }
        confirmLabel={t('common.actions.delete')}
        cancelLabel={t('common.actions.cancel')}
        destructive
        loading={deleteLoading}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCategoryLabel(cat: string): string {
  return CATEGORY_BADGE_MAP[cat]?.label ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

function renderMoMHint(summary: ExpenseSummary | undefined): string | undefined {
  if (!summary) return undefined;
  if (summary.monthOverMonthPct === null) return 'No prior month data';
  const pct = summary.monthOverMonthPct;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% vs last month`;
}

function momTone(
  summary: ExpenseSummary | undefined,
): 'neutral' | 'positive' | 'negative' {
  if (!summary || summary.monthOverMonthPct === null) return 'neutral';
  // For expenses, higher = worse
  return summary.monthOverMonthPct > 0 ? 'negative' : 'positive';
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  hint,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint?: string;
  loading: boolean;
  tone: 'neutral' | 'positive' | 'negative';
}) {
  const hintColor =
    tone === 'negative'
      ? 'text-danger-fg'
      : tone === 'positive'
        ? 'text-success-fg'
        : 'text-neutral-500';

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {label}
          </p>
          <div className="mt-1.5">
            {loading && !value ? (
              <Skeleton variant="text" width="60%" height="28px" />
            ) : (
              <p className="text-xl font-semibold text-neutral-900">
                {value ?? '—'}
              </p>
            )}
          </div>
          {hint && <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
          {icon}
        </div>
      </div>
    </div>
  );
}
