import type { BadgeVariant } from '../../types/ui';

/**
 * Generate initials from first and last name.
 */
export function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/**
 * Map a payment status string to a Badge variant.
 */
export function paymentBadgeVariant(status: string | null | undefined): BadgeVariant {
  switch ((status ?? '').toLowerCase()) {
    case 'paid':
      return 'paid';
    case 'partial':
      return 'partial';
    case 'unpaid':
      return 'unpaid';
    default:
      return 'pending';
  }
}
