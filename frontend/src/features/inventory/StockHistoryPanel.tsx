import { useQuery } from '@tanstack/react-query';
import { Modal, Skeleton } from '../../components/ui';
import {
  ClockIcon,
  InboxIcon,
} from '../../components/ui/Icon';
import { getStockHistory } from './inventoryApi';
import type { EquipmentItem } from './inventoryApi';
import { formatDZD, formatDateTime } from '../payments/utils';

export interface StockHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  item: EquipmentItem | null;
}

export function StockHistoryPanel({
  open,
  onClose,
  item,
}: StockHistoryPanelProps) {
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['inventory', 'history', item?.id],
    queryFn: () => getStockHistory(item!.id),
    enabled: open && Boolean(item),
  });

  const history = data?.history ?? [];

  if (!item) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Historique - ${item.name}`}
      description={`Stock actuel: ${item.stockQuantity} | Prix: ${formatDZD(item.price)}`}
      size="lg"
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-3" aria-live="polite">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-lg border border-neutral-100 p-4">
                <Skeleton variant="text" lines={2} />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger-fg"
          >
            Impossible de charger l&apos;historique. Veuillez reessayer.
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && history.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <InboxIcon size={28} />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800">
                Aucun historique
              </p>
              <p className="text-xs text-neutral-500">
                Aucun ajustement de stock enregistre pour cet equipement.
              </p>
            </div>
          </div>
        )}

        {/* History List */}
        {!isLoading && !isError && history.length > 0 && (
          <div className="space-y-2">
            {history.map((entry) => {
              const isPositive = entry.quantityChange > 0;
              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-neutral-100 p-4 transition-colors hover:bg-neutral-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Change indicator */}
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isPositive
                            ? 'bg-success-bg text-success-fg'
                            : 'bg-danger-bg text-danger-fg'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {entry.quantityChange}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800">
                          {entry.reason}
                        </p>
                        {entry.notes && (
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {entry.notes}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-neutral-400">
                          ID: {entry.performedBy}
                        </p>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex shrink-0 items-center gap-1 text-xs text-neutral-400">
                      <ClockIcon size={12} />
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
