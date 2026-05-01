/**
 * Formats an ISO date string (YYYY-MM-DD or full ISO) to "DD MMM YYYY" in French locale.
 * Returns null if the input is null/undefined/empty.
 */
export function formatDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-DZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns a relative label in French for a given ISO date.
 * e.g. "dans 3 jours" or "il y a 5 jours".
 * Returns null if input is null/undefined/empty.
 */
export function getRelativeLabel(iso: string | null | undefined): {
  label: string;
  overdue: boolean;
} | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  // Compare dates at midnight precision
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMs = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: "aujourd'hui", overdue: false };
  if (diffDays === 1) return { label: 'demain', overdue: false };
  if (diffDays === -1) return { label: 'hier', overdue: true };
  if (diffDays > 0) return { label: `dans ${diffDays} jours`, overdue: false };
  return { label: `il y a ${Math.abs(diffDays)} jours`, overdue: true };
}
