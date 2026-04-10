import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { BadgeVariant } from '../../types/ui';
import {
  CheckIcon,
  BanIcon,
  PauseIcon,
  HourglassIcon,
  ClockIcon,
  DollarIcon,
  AlertIcon,
  XIcon,
} from './Icon';

export interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

interface VariantConfig {
  label: string;
  icon: ReactNode;
  classes: string;
}

const CONFIG: Record<BadgeVariant, VariantConfig> = {
  active: {
    label: 'Active',
    icon: <CheckIcon size={12} />,
    classes: 'bg-success-bg text-success-fg border-success/20',
  },
  inactive: {
    label: 'Inactive',
    icon: <PauseIcon size={12} />,
    classes: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  },
  suspended: {
    label: 'Suspended',
    icon: <BanIcon size={12} />,
    classes: 'bg-warning-bg text-warning-fg border-warning/30',
  },
  expired: {
    label: 'Expired',
    icon: <ClockIcon size={12} />,
    classes: 'bg-danger-bg text-danger-fg border-danger/20',
  },
  pending: {
    label: 'Pending',
    icon: <HourglassIcon size={12} />,
    classes: 'bg-info-bg text-info-fg border-info/20',
  },
  paid: {
    label: 'Paid',
    icon: <DollarIcon size={12} />,
    classes: 'bg-success-bg text-success-fg border-success/20',
  },
  partial: {
    label: 'Partial',
    icon: <AlertIcon size={12} />,
    classes: 'bg-warning-bg text-warning-fg border-warning/30',
  },
  unpaid: {
    label: 'Unpaid',
    icon: <XIcon size={12} />,
    classes: 'bg-danger-bg text-danger-fg border-danger/20',
  },
};

export function Badge({ variant, label, className }: BadgeProps) {
  const cfg = CONFIG[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        cfg.classes,
        className,
      )}
    >
      <span aria-hidden>{cfg.icon}</span>
      <span>{label ?? cfg.label}</span>
    </span>
  );
}
