import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AlertCardSkeleton } from './AlertCard';

const MAX_VISIBLE = 5;

interface AlertSectionProps {
  sectionKey: string;
  title: string;
  count: number;
  countPillClass: string;
  dotClass: string;
  loading: boolean;
  /** Link target for "voir tout". Use '#' if there is no filtered list view. */
  viewAllHref: string;
  emptyLabel: string;
  children: ReactNode;
  /** If provided, shows a "View N more" footer link when count > MAX_VISIBLE */
  moreCount?: number;
  moreHref?: string;
  isLast?: boolean;
}

export function AlertSection({
  sectionKey,
  title,
  count,
  countPillClass,
  dotClass,
  loading,
  viewAllHref,
  emptyLabel,
  children,
  moreCount = 0,
  moreHref = '#',
  isLast = false,
}: AlertSectionProps) {
  return (
    <section
      id={`section-${sectionKey}`}
      aria-labelledby={`section-title-${sectionKey}`}
      className={cn(
        'rounded-lg border border-neutral-200 bg-white shadow-elevation-1 overflow-hidden',
        isLast && 'lg:col-span-2',
      )}
    >
      {/* Section header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-neutral-100">
        <span
          className={cn('h-2 w-2 rounded-full shrink-0', dotClass)}
          aria-hidden="true"
        />
        <h2
          id={`section-title-${sectionKey}`}
          className="text-sm font-semibold text-neutral-800 flex-1"
        >
          {title}
        </h2>
        {!loading && (
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
              countPillClass,
            )}
          >
            {count}
          </span>
        )}
        {loading && (
          <Skeleton variant="block" width="28px" height="20px" className="rounded-full" />
        )}
        <Link
          to={viewAllHref}
          className={cn(
            'ml-auto flex items-center gap-1 text-xs font-medium text-primary-500',
            'hover:text-primary-600 transition-colors duration-150 cursor-pointer',
            'focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm',
          )}
          aria-label={`Voir tout — ${title}`}
        >
          Voir tout
          <Icon name="arrow-right" size={12} />
        </Link>
      </div>

      {/* Section body */}
      <div className="divide-y divide-neutral-100">
        {loading ? (
          <>
            <AlertCardSkeleton />
            <AlertCardSkeleton />
            <AlertCardSkeleton />
          </>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Icon name="inbox" size={32} className="text-neutral-300" />
            <span className="text-sm text-neutral-400">{emptyLabel}</span>
          </div>
        ) : (
          <>
            {children}
            {moreCount > 0 && (
              <Link
                to={moreHref}
                className={cn(
                  'block px-4 py-2.5 text-xs font-medium text-primary-500',
                  'hover:text-primary-600 hover:bg-primary-50 transition-colors duration-150',
                  'cursor-pointer text-center border-t border-neutral-100',
                )}
              >
                Voir {moreCount} de plus
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export { MAX_VISIBLE };
