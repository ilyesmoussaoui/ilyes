import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { ChevronDownIcon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import { exportReport, type ExportResponse } from './reportsApi';
import { printDocument } from '../../lib/print';

interface ExportDropdownProps {
  reportType: string;
  dateFrom?: string;
  dateTo?: string;
  disciplineId?: string;
}

function escapeCell(cell: string | number | null): string {
  const str = cell === null || cell === undefined ? '' : String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(data: ExportResponse) {
  const csvContent = [
    data.headers.map(escapeCell).join(','),
    ...data.rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n');

  // Always download as .csv regardless of the fileName extension
  const baseName = (data.fileName || `${Date.now()}_report`)
    .replace(/\.(xlsx|xls|pdf)$/i, '');
  const downloadName = `${baseName}.csv`;

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportDropdown({
  reportType,
  dateFrom,
  dateTo,
  disciplineId,
}: ExportDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleExport = async (format: 'excel' | 'pdf') => {
    setLoading(true);
    setOpen(false);
    try {
      if (format === 'pdf') {
        printDocument();
      } else {
        const data = await exportReport({
          reportType,
          format,
          dateFrom,
          dateTo,
          disciplineId,
        });
        if (!data.rows || data.rows.length === 0) {
          toast.show({
            type: 'info',
            title: t('common.empty.noData'),
            description: t('common.empty.tryDifferentFilter'),
          });
          return;
        }
        downloadCsv(data);
        toast.show({
          type: 'success',
          title: t('reports.export.label'),
          description: `${data.rows.length}`,
        });
      }
    } catch (err) {
      toast.show({
        type: 'error',
        title: t('common.messages.saveFailed'),
        description:
          err instanceof Error
            ? err.message
            : t('common.messages.tryAgainLater'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="secondary"
        loading={loading}
        iconRight={<ChevronDownIcon size={14} />}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {t('reports.export.label')}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-2">
          <button
            type="button"
            onClick={() => handleExport('excel')}
            className={cn(
              'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-700',
              'transition-colors hover:bg-primary-50 hover:text-primary-600',
            )}
          >
            {t('reports.export.csv')}
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            className={cn(
              'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-700',
              'transition-colors hover:bg-primary-50 hover:text-primary-600',
            )}
          >
            {t('reports.export.print')}
          </button>
        </div>
      )}
    </div>
  );
}
