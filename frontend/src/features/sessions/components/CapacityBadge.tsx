import { cn } from '../../../lib/cn';

interface CapacityBadgeProps {
  current: number;
  max: number;
  className?: string;
}

function getCapacityLevel(current: number, max: number): 'normal' | 'warning' | 'danger' {
  if (max <= 0) return 'normal';
  const pct = current / max;
  if (pct >= 1) return 'danger';
  if (pct >= 0.9) return 'warning';
  return 'normal';
}

const LEVEL_CLASSES: Record<ReturnType<typeof getCapacityLevel>, string> = {
  normal: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
};

export function CapacityBadge({ current, max, className }: CapacityBadgeProps) {
  const level = getCapacityLevel(current, max);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        LEVEL_CLASSES[level],
        className,
      )}
      aria-label={`${current} of ${max} enrolled`}
    >
      {current}/{max}
    </span>
  );
}
