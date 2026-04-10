import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { TableColumn } from '../../types/ui';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { ChevronDownIcon, ChevronUpIcon, InboxIcon } from './Icon';

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export function Table<T>({
  columns,
  data,
  getRowId,
  loading,
  pageSize = 10,
  emptyTitle = 'No records',
  emptyMessage = 'There is nothing to show here yet.',
  onRowClick,
  className,
}: TableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = String(col.accessor(a) ?? '');
      const bv = String(col.accessor(b) ?? '');
      return sort.direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return copy;
  }, [data, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-1', className)}>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const alignClass =
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={cn(
                      'border-b border-neutral-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500',
                      alignClass,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-neutral-800"
                      >
                        {col.header}
                        <span className="flex flex-col">
                          <ChevronUpIcon
                            size={10}
                            className={cn(isSorted && sort?.direction === 'asc' ? 'text-primary-500' : 'text-neutral-300')}
                          />
                          <ChevronDownIcon
                            size={10}
                            className={cn(isSorted && sort?.direction === 'desc' ? 'text-primary-500' : 'text-neutral-300')}
                          />
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={`s-${i}`}>
                  {columns.map((col, ci) => (
                    <td key={`s-${i}-${col.key}-${ci}`} className="border-b border-neutral-100 px-4 py-3">
                      <Skeleton variant="text" lines={1} width="80%" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  <EmptyState title={emptyTitle} message={emptyMessage} />
                </td>
              </tr>
            ) : (
              paged.map((row, index) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-neutral-100 transition-colors',
                    index % 2 === 1 && 'bg-neutral-50/40',
                    onRowClick && 'cursor-pointer hover:bg-primary-50/60',
                  )}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                    return (
                      <td key={col.key} className={cn('px-4 py-3 text-neutral-800', alignClass)}>
                        {col.accessor(row)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
          <span>
            Page {safePage} of {totalPages} — {sorted.length} records
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="default"
              disabled={safePage === 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="default"
              disabled={safePage === totalPages}
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <InboxIcon size={28} />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-800">{title}</p>
        <p className="text-xs text-neutral-500">{message}</p>
      </div>
    </div>
  );
}
