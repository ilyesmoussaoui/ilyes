import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Skeleton } from '../../components/ui/Skeleton';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  accentColor?: 'primary' | 'success' | 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const ACCENT_BORDER: Record<NonNullable<MetricCardProps['accentColor']>, string> = {
  primary: 'border-t-primary-500',
  success: 'border-t-success',
  danger: 'border-t-danger',
  warning: 'border-t-warning',
  info: 'border-t-info',
};

const ACCENT_ICON_BG: Record<NonNullable<MetricCardProps['accentColor']>, string> = {
  primary: 'bg-primary-50 text-primary-500',
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accentColor = 'primary',
  loading,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 border-t-[3px] border-t-neutral-200 bg-white p-5 shadow-elevation-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton variant="text" lines={1} width="60%" />
            <div className="mt-3">
              <Skeleton variant="text" lines={1} width="40%" />
            </div>
          </div>
          <Skeleton variant="avatar" width="36" height="36" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 border-t-[3px] bg-white p-5 shadow-elevation-1',
        'transition-shadow hover:shadow-elevation-2',
        ACCENT_BORDER[accentColor],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {title}
          </p>
          <p className="mt-1 text-xl font-bold text-neutral-900 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-neutral-400">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              ACCENT_ICON_BG[accentColor],
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
