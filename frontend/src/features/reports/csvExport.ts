/**
 * Shared CSV export utilities for report components.
 * Handles BOM, RFC-4180 escaping, and browser download trigger.
 */

function escapeCell(cell: string | number | null | undefined): string {
  const str = cell === null || cell === undefined ? '' : String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a CSV string and triggers a browser file download.
 * @param headers - Column header labels
 * @param rows    - Data rows (each cell is string | number | null)
 * @param baseName - File name without extension (date suffix is appended automatically)
 */
export function downloadCsv(
  headers: string[],
  rows: (string | number | null)[][],
  baseName: string,
): void {
  const today = new Date().toISOString().split('T')[0];
  const fileName = `${baseName}_${today}.csv`;

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n');

  // BOM prefix ensures correct UTF-8 rendering in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
