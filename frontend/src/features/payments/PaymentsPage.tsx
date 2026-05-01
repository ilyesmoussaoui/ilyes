import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  Select,
  Badge,
  Modal,
  Skeleton,
} from '../../components/ui';
import { useToast } from '../../components/ui';
import {
  ChevronRightIcon,
  SearchIcon,
  EyeIcon,
  RefreshIcon,
  ChevronLeftIcon,
  InboxIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '../../components/ui/Icon';
import { getPayments, refundPayment } from './paymentsApi';
import type { PaymentRecord } from './paymentsApi';
import { formatDZD, formatDate } from './utils';
import { paymentTypeToBadge } from './components/paymentBadgeMap';
import { ReceiptDetailModal } from './components/ReceiptDetailModal';

type SortKey = 'createdAt' | 'totalAmount' | 'receiptNumber';
type SortDir = 'asc' | 'desc';

const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'full', label: 'Full Payment' },
  { value: 'partial', label: 'Partial' },
  { value: 'later', label: 'Pay Later' },
  { value: 'refund', label: 'Refund' },
  { value: 'adjustment', label: 'Adjustment' },
];

const PAGE_SIZE = 20;

export function PaymentsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Seed search from ?receipt= query param so deep-links from global search work.
  const receiptParam = searchParams.get('receipt') ?? '';

  // Filters
  const [search, setSearch] = useState(receiptParam);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Modals
  const [viewPayment, setViewPayment] = useState<PaymentRecord | null>(null);
  const [autoOpenReceipt, setAutoOpenReceipt] = useState<string | null>(
    receiptParam || null,
  );
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
      paymentType: paymentType || undefined,
      search: search.trim() || undefined,
      sortBy,
      sortOrder: sortDir,
    }),
    [page, dateFrom, dateTo, paymentType, search, sortBy, sortDir],
  );

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['payments', queryParams],
    queryFn: () => getPayments(queryParams),
    placeholderData: (prev) => prev,
  });

  const payments = data?.payments ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Auto-open receipt detail from ?receipt= deep-link once the list loads.
  useEffect(() => {
    if (!autoOpenReceipt || isLoading) return;
    const match = payments.find(
      (p) => p.receiptNumber?.toLowerCase() === autoOpenReceipt.toLowerCase(),
    );
    if (match) {
      setViewPayment(match);
      setAutoOpenReceipt(null);
      // Strip the query param now that we've consumed it
      searchParams.delete('receipt');
      setSearchParams(searchParams, { replace: true });
    } else if (payments.length > 0) {
      // Loaded but no match — show a toast so the user isn't confused
      toast.show({
        type: 'warning',
        title: t('common.messages.notFound'),
        description: `${autoOpenReceipt}`,
      });
      setAutoOpenReceipt(null);
      searchParams.delete('receipt');
      setSearchParams(searchParams, { replace: true });
    }
  }, [autoOpenReceipt, payments, isLoading, searchParams, setSearchParams, toast, t]);

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

  const handleRefund = async () => {
    if (!refundTarget || !refundReason.trim()) return;
    setRefundLoading(true);
    try {
      await refundPayment(refundTarget.id, refundReason.trim());
      toast.show({
        type: 'success',
        title: t('payments.status.refunded'),
        description: t('payments.receipt.title', { number: refundTarget.receiptNumber ?? '' }),
      });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    } catch {
      toast.show({
        type: 'error',
        title: t('common.messages.saveFailed'),
        description: t('common.messages.tryAgainLater'),
      });
    } finally {
      setRefundLoading(false);
      setRefundTarget(null);
      setRefundReason('');
    }
  };

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
          <li className="font-semibold text-neutral-700">{t('payments.breadcrumb')}</li>
        </ol>
      </nav>

      {/* Header */}
      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-neutral-900">
              {t('payments.title')}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {t('payments.subtitle')}
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="mt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={t('common.actions.search')}
              placeholder={t('payments.search')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              iconLeft={<SearchIcon size={16} />}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              label={t('common.labels.type')}
              options={PAYMENT_TYPE_OPTIONS}
              value={paymentType}
              onChange={(v) => {
                setPaymentType(v);
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
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              aria-label={t('common.labels.dateTo')}
            />
          </div>
        </div>
      </Card>

      {/* Error State */}
      {isError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger-fg"
        >
          {t('payments.failedToLoad')}{' '}
          {error instanceof Error ? error.message : t('common.messages.tryAgainLater')}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-1">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label={t('payments.title')}>
            <thead className="bg-neutral-50">
              <tr>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('payments.columns.receipt')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('payments.columns.member')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {renderSortHeader(t('payments.columns.date'), 'createdAt')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {renderSortHeader(t('common.labels.total'), 'totalAmount')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('common.labels.paid')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('common.labels.due')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('common.labels.type')}
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
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {Array.from({ length: 8 }, (__, ci) => (
                      <td
                        key={`skeleton-${i}-${ci}`}
                        className="border-b border-neutral-100 px-4 py-3"
                      >
                        <Skeleton variant="text" lines={1} width="80%" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                        <InboxIcon size={28} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">{t('payments.empty')}</p>
                        <p className="text-xs text-neutral-500">
                          {search || paymentType || dateFrom || dateTo
                            ? t('common.empty.tryDifferentFilter')
                            : t('common.empty.noData')}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((p, idx) => {
                  const badge = paymentTypeToBadge(p.paymentType);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-neutral-100 transition-colors hover:bg-neutral-50 ${
                        idx % 2 === 1 ? 'bg-neutral-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-neutral-700">
                        #{p.receiptNumber}
                      </td>
                      <td className="px-4 py-3 text-neutral-800">{p.memberName}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-800">
                        {formatDZD(p.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-800">
                        {formatDZD(p.paidAmount)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          p.remaining > 0 ? 'text-danger' : 'text-neutral-400'
                        }`}
                      >
                        {formatDZD(p.remaining)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={badge.variant} label={badge.label} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewPayment(p)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label={`${t('common.actions.view')} ${p.receiptNumber}`}
                          >
                            <EyeIcon size={14} />
                            {t('common.actions.view')}
                          </button>
                          {p.paymentType !== 'refund' && p.paidAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => setRefundTarget(p)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                              aria-label={`${t('payments.status.refunded')} ${p.receiptNumber}`}
                            >
                              <RefreshIcon size={14} />
                              {t('payments.status.refunded')}
                            </button>
                          )}
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
        {!isLoading && total > PAGE_SIZE && (
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

      {/* Receipt Detail Modal */}
      <ReceiptDetailModal
        open={viewPayment !== null}
        payment={viewPayment}
        onClose={() => setViewPayment(null)}
      />

      {/* Refund Confirmation */}
      <Modal
        open={refundTarget !== null}
        onClose={() => { setRefundTarget(null); setRefundReason(''); }}
        title={t('payments.status.refunded')}
        size="sm"
      >
        {refundTarget && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {formatDZD(refundTarget.paidAmount)} — #{refundTarget.receiptNumber}. {t('common.messages.actionIrreversible')}
            </p>
            <Input
              label={t('common.labels.reason')}
              placeholder={t('common.labels.reason')}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              error={refundReason.length === 0 ? undefined : undefined}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setRefundTarget(null); setRefundReason(''); }} disabled={refundLoading}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleRefund()}
                loading={refundLoading}
                disabled={!refundReason.trim() || refundLoading}
              >
                {t('payments.status.refunded')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
