import { cn } from '../../lib/cn';

export type SkeletonVariant = 'text' | 'avatar' | 'card' | 'row';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  lines?: number;
  width?: string;
  height?: string;
}

export function Skeleton({ variant = 'text', className, lines = 1, width, height }: SkeletonProps) {
  if (variant === 'text') {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="skeleton-shimmer animate-shimmer h-3 rounded"
            style={{ width: width ?? (i === lines - 1 ? '70%' : '100%') }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div
        className={cn('skeleton-shimmer animate-shimmer rounded-full', className)}
        style={{ width: width ?? 40, height: height ?? 40 }}
        aria-hidden="true"
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'rounded-lg border border-neutral-200 bg-white p-6 shadow-elevation-1',
          className,
        )}
        aria-hidden="true"
      >
        <div className="skeleton-shimmer animate-shimmer mb-4 h-4 w-1/3 rounded" />
        <div className="skeleton-shimmer animate-shimmer mb-2 h-3 w-full rounded" />
        <div className="skeleton-shimmer animate-shimmer mb-2 h-3 w-5/6 rounded" />
        <div className="skeleton-shimmer animate-shimmer h-3 w-3/4 rounded" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-4 px-4 py-3', className)} aria-hidden="true">
      <div className="skeleton-shimmer animate-shimmer h-8 w-8 shrink-0 rounded-full" />
      <div className="skeleton-shimmer animate-shimmer h-3 flex-1 rounded" />
      <div className="skeleton-shimmer animate-shimmer h-3 w-20 rounded" />
      <div className="skeleton-shimmer animate-shimmer h-3 w-16 rounded" />
    </div>
  );
}
