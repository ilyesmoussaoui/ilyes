export function formatMoney(centimes: number): string {
  return `${(centimes / 100).toFixed(2)} DZD`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return (
    date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) +
    ' ' +
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

export function getDisplayName(profile: {
  firstNameLatin: string | null;
  lastNameLatin: string | null;
}): string {
  return (
    [profile.firstNameLatin, profile.lastNameLatin].filter(Boolean).join(' ') ||
    'Unknown'
  );
}
