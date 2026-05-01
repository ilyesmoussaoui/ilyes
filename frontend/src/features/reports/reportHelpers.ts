/** Format centimes to DZD display string */
export function formatDZD(centimes: number): string {
  const amount = centimes / 100;
  return `DZD ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a number for short display (1234 -> "1,234") */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/** Format a percentage for display */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format an hour (0-23) as readable time string */
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/** Format an ISO date string to short readable format */
export function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

/** Format a timestamp for "Last updated" display */
export function formatTimestamp(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

/** Get default date range (last 30 days) */
export function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = now.toISOString().split('T')[0];
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const dateFrom = from.toISOString().split('T')[0];
  return { dateFrom, dateTo };
}
