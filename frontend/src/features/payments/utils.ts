/**
 * Format an amount in centimes to a display string with space-separated thousands in DZD.
 * Example: formatDZD(150000) => "1 500 DZD"
 */
export function formatDZD(centimes: number): string {
  const whole = Math.round(centimes / 100);
  const formatted = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} DZD`;
}

/**
 * Parse a DZD amount string entered by user (whole dinars) into centimes.
 * Strips spaces, commas, and "DZD" suffix.
 */
export function parseDZDInput(input: string): number {
  const cleaned = input.replace(/[^0-9]/g, '');
  const value = parseInt(cleaned, 10);
  return isNaN(value) ? 0 : value * 100;
}

/**
 * Format a date string to a locale-friendly display format.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date+time for receipt display.
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
