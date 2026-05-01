import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export type EmptyStateIllustration =
  | 'members'
  | 'inbox'
  | 'search'
  | 'calendar'
  | 'cart'
  | 'inventory'
  | 'chart'
  | 'generic';

export interface EmptyStateProps {
  illustration?: EmptyStateIllustration;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * EmptyState — shown when an async list/view has zero results.
 * Includes a small, inline SVG illustration + copy + primary CTA.
 */
export function EmptyState({
  illustration = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-4 py-10' : 'gap-5 px-4 py-16 sm:py-20',
        'rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60',
        className,
      )}
    >
      <Illustration kind={illustration} compact={compact} />
      <div className="max-w-sm space-y-1.5">
        <h3 className={cn('font-semibold text-neutral-800', compact ? 'text-base' : 'text-lg')}>
          {title}
        </h3>
        {description && (
          <p className={cn('text-neutral-500', compact ? 'text-xs' : 'text-sm')}>{description}</p>
        )}
      </div>
      {(actionLabel || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

function Illustration({
  kind,
  compact,
}: {
  kind: EmptyStateIllustration;
  compact: boolean;
}) {
  const size = compact ? 56 : 72;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 72 72',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    className: 'text-primary-500',
  } as const;

  if (kind === 'members') {
    return (
      <svg {...common}>
        <circle cx="36" cy="36" r="34" fill="currentColor" fillOpacity="0.08" />
        <circle cx="36" cy="30" r="9" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M20 54c2-8 9-13 16-13s14 5 16 13"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'inbox') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="64" height="64" rx="16" fill="currentColor" fillOpacity="0.08" />
        <path
          d="M16 34h12l3 6h10l3-6h12v18a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V34Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M22 18h28l6 16H16l6-16Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'search') {
    return (
      <svg {...common}>
        <circle cx="36" cy="36" r="34" fill="currentColor" fillOpacity="0.08" />
        <circle cx="32" cy="32" r="12" stroke="currentColor" strokeWidth="2.5" />
        <path d="m42 42 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'calendar') {
    return (
      <svg {...common}>
        <rect x="10" y="14" width="52" height="48" rx="8" fill="currentColor" fillOpacity="0.08" />
        <rect x="10" y="14" width="52" height="48" rx="8" stroke="currentColor" strokeWidth="2.5" />
        <path d="M10 28h52" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 8v12M48 8v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'cart') {
    return (
      <svg {...common}>
        <circle cx="36" cy="36" r="34" fill="currentColor" fillOpacity="0.08" />
        <path
          d="M18 20h6l4 24h22l4-16H28"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="52" r="3" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="48" cy="52" r="3" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    );
  }
  if (kind === 'inventory') {
    return (
      <svg {...common}>
        <rect x="8" y="8" width="56" height="56" rx="8" fill="currentColor" fillOpacity="0.08" />
        <path d="M8 24h56" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 8v56M48 8v56" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    );
  }
  if (kind === 'chart') {
    return (
      <svg {...common}>
        <rect x="8" y="8" width="56" height="56" rx="8" fill="currentColor" fillOpacity="0.08" />
        <path
          d="M18 50V36M30 50V24M42 50V30M54 50V20"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="36" cy="36" r="34" fill="currentColor" fillOpacity="0.08" />
      <path
        d="M22 36h28M36 22v28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
