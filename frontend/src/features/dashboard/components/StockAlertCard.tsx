import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { Icon } from '../../../components/ui/Icon';
import type { AlertStockItem } from '../types';

interface StockAlertCardProps {
  item: AlertStockItem;
}

export function StockAlertCard({ item }: StockAlertCardProps) {
  const { equipmentId, name, stockQuantity } = item;

  // Link to inventory route. The inventory page exists at /inventory.
  // A direct product deep-link doesn't exist yet, so we link to /inventory
  // with an id param — the inventory page can handle it when ready.
  const to = `/inventory?item=${equipmentId}`;

  const isOutOfStock = stockQuantity === 0;

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-md border border-neutral-200',
        'bg-white shadow-elevation-1 cursor-pointer transition-all duration-150',
        'hover:shadow-elevation-2 hover:border-neutral-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        'focus-visible:ring-offset-1',
      )}
    >
      <Icon name="package" size={20} className="shrink-0 text-neutral-400" />

      <span className="min-w-0 flex-1 text-sm font-medium text-neutral-800 truncate">
        {name}
      </span>

      {isOutOfStock ? (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
            'bg-danger-bg text-danger-fg border-danger/20 shrink-0',
          )}
        >
          Rupture
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
            'bg-warning-bg text-warning-fg border-warning/30 shrink-0',
          )}
        >
          {stockQuantity} restant
        </span>
      )}

      <Icon
        name="arrow-right"
        size={14}
        className="shrink-0 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      />
    </Link>
  );
}
