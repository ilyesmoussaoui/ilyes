import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  Badge,
  ConfirmModal,
  Skeleton,
} from '../../components/ui';
import { useToast } from '../../components/ui';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  InboxIcon,
  SearchIcon,
  PackageIcon,
  AlertIcon,
} from '../../components/ui/Icon';
import {
  getEquipmentList,
  deactivateEquipment,
} from './inventoryApi';
import type { EquipmentItem } from './inventoryApi';
import { EquipmentFormModal } from './EquipmentFormModal';
import { StockAdjustModal } from './StockAdjustModal';
import { StockHistoryPanel } from './StockHistoryPanel';
import { formatDZD } from '../payments/utils';
import type { BadgeVariant } from '../../types/ui';

const PAGE_SIZE = 20;

const LOW_STOCK_THRESHOLD = 10;

function getStockBadge(
  stockQuantity: number,
  t: (k: string) => string,
): { variant: BadgeVariant; label: string } {
  if (stockQuantity === 0) return { variant: 'expired', label: t('inventory.badge.outOfStock') };
  if (stockQuantity < LOW_STOCK_THRESHOLD) return { variant: 'suspended', label: t('inventory.badge.lowStock') };
  return { variant: 'active', label: t('inventory.badge.inStock') };
}

export function InventoryPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentItem | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<EquipmentItem | null>(null);
  const [historyTarget, setHistoryTarget] = useState<EquipmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: search.trim() || undefined,
      lowStock: lowStockOnly || undefined,
    }),
    [page, search, lowStockOnly],
  );

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['inventory', queryParams],
    queryFn: () => getEquipmentList(queryParams),
    placeholderData: (prev) => prev,
  });

  const equipment = data?.equipment ?? [];
  const total = data?.total ?? 0;
  const totalValue = data?.totalValue ?? 0;
  const lowStockCount = data?.lowStockCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidateInventory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }, [queryClient]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deactivateEquipment(deleteTarget.id);
      toast.show({
        type: 'success',
        title: t('inventory.toast.deactivated'),
        description: t('inventory.toast.deactivatedDesc', { name: deleteTarget.name }),
      });
      invalidateInventory();
    } catch {
      toast.show({
        type: 'error',
        title: t('inventory.toast.deactivateFailed'),
        description: t('inventory.toast.deactivateFailedDesc'),
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const openEditModal = (item: EquipmentItem) => {
    setEditTarget(item);
    setFormOpen(true);
  };

  const openAddModal = () => {
    setEditTarget(null);
    setFormOpen(true);
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
          <li className="font-semibold text-neutral-700">{t('inventory.breadcrumb')}</li>
        </ol>
      </nav>

      {/* Header */}
      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-neutral-900">
              {t('inventory.title')}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {t('inventory.subtitle')}
            </p>
          </div>
          <Button
            variant="primary"
            iconLeft={<PlusIcon size={16} />}
            onClick={openAddModal}
          >
            {t('inventory.add')}
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
              <PackageIcon size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('inventory.summary.totalItems')}
              </p>
              <p className="text-xl font-bold text-neutral-900">
                {isLoading ? (
                  <span className="skeleton-shimmer animate-shimmer inline-block h-6 w-12 rounded" />
                ) : (
                  total
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-bg text-warning-fg">
              <AlertIcon size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('inventory.summary.lowStock')}
              </p>
              <p className="text-xl font-bold text-neutral-900">
                {isLoading ? (
                  <span className="skeleton-shimmer animate-shimmer inline-block h-6 w-12 rounded" />
                ) : (
                  lowStockCount
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-bg text-success-fg">
              <PackageIcon size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('inventory.summary.totalValue')}
              </p>
              <p className="text-xl font-bold text-neutral-900">
                {isLoading ? (
                  <span className="skeleton-shimmer animate-shimmer inline-block h-6 w-20 rounded" />
                ) : (
                  formatDZD(totalValue)
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-72">
            <Input
              label={t('inventory.search')}
              placeholder={t('inventory.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              iconLeft={<SearchIcon size={16} />}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-400"
            />
            <span className="font-medium">{t('inventory.lowStockOnly')}</span>
          </label>
        </div>
      </Card>

      {/* Error State */}
      {isError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger-fg"
        >
          {t('inventory.loadFailed')}{' '}
          {error instanceof Error ? error.message : t('common.actions.tryAgain')}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-1">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label={t('inventory.title')}>
            <thead className="bg-neutral-50">
              <tr>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('inventory.columns.name')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('inventory.columns.discipline')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('inventory.columns.price')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('inventory.columns.stock')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('inventory.columns.status')}
                </th>
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t('inventory.columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
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
              ) : equipment.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                        <InboxIcon size={28} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">
                          {t('inventory.empty.title')}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {search || lowStockOnly
                            ? t('inventory.empty.tryFilters')
                            : t('inventory.empty.addFirst')}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                equipment.map((item, idx) => {
                  const badge = getStockBadge(item.stockQuantity, t);
                  const isLowStock = item.stockQuantity < LOW_STOCK_THRESHOLD;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-neutral-100 transition-colors hover:bg-neutral-50 ${
                        isLowStock
                          ? 'bg-warning-bg/30'
                          : idx % 2 === 1
                            ? 'bg-neutral-50/40'
                            : ''
                      }`}
                    >
                      {/* Name - clickable for history */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setHistoryTarget(item)}
                          className="text-left font-medium text-neutral-900 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:rounded"
                          aria-label={`${t('inventory.history.title')} — ${item.name}`}
                        >
                          {item.name}
                        </button>
                      </td>

                      {/* Discipline */}
                      <td className="px-4 py-3 text-neutral-600">
                        {item.disciplineName ?? '\u2014'}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right font-medium text-neutral-800">
                        {formatDZD(item.price)}
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-sm font-bold ${
                            item.stockQuantity === 0
                              ? 'bg-danger-bg text-danger-fg'
                              : item.stockQuantity < LOW_STOCK_THRESHOLD
                                ? 'bg-warning-bg text-warning-fg'
                                : 'text-neutral-800'
                          }`}
                        >
                          {item.stockQuantity}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant} label={badge.label} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label={`${t('inventory.edit')} ${item.name}`}
                          >
                            <EditIcon size={14} />
                            <span className="hidden sm:inline">{t('inventory.edit')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustTarget(item)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label={`${t('inventory.adjust')} ${item.name}`}
                          >
                            <PackageIcon size={14} />
                            <span className="hidden sm:inline">{t('inventory.adjust')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                            aria-label={`${t('inventory.deactivate')} ${item.name}`}
                          >
                            <TrashIcon size={14} />
                            <span className="hidden lg:inline">{t('inventory.deactivate')}</span>
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
        {!isLoading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            <span>
              {t('inventory.pagination', { page, total: totalPages, count: total })}
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
      <EquipmentFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSuccess={invalidateInventory}
        editItem={editTarget}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustModal
        open={adjustTarget !== null}
        onClose={() => setAdjustTarget(null)}
        onSuccess={invalidateInventory}
        item={adjustTarget}
      />

      {/* Stock History Panel */}
      <StockHistoryPanel
        open={historyTarget !== null}
        onClose={() => setHistoryTarget(null)}
        item={historyTarget}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={t('inventory.confirmDeactivate.title')}
        message={
          deleteTarget
            ? t('inventory.confirmDeactivate.message', { name: deleteTarget.name })
            : ''
        }
        confirmLabel={t('inventory.confirmDeactivate.confirm')}
        cancelLabel={t('inventory.confirmDeactivate.cancel')}
        destructive
        loading={deleteLoading}
      />
    </div>
  );
}
