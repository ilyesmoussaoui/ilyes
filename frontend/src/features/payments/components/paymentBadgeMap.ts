import type { BadgeVariant } from '../../../types/ui';

interface BadgeConfig {
  variant: BadgeVariant;
  label: string;
}

export function paymentTypeToBadge(type: string): BadgeConfig {
  switch (type) {
    case 'full':
      return { variant: 'paid', label: 'Full' };
    case 'partial':
      return { variant: 'partial', label: 'Partial' };
    case 'later':
      return { variant: 'unpaid', label: 'Pay Later' };
    case 'refund':
      return { variant: 'expired', label: 'Refund' };
    case 'adjustment':
      return { variant: 'pending', label: 'Adjustment' };
    default:
      return { variant: 'pending', label: type };
  }
}
