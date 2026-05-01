import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Input, Skeleton } from '../../../../components/ui';
import type { AuditLogEntry, PaginatedResponse } from '../profileTypes';
import type { TableColumn } from '../../../../types/ui';
import { getMemberAuditLog } from '../profileApi';
import { formatDateTime } from '../profileUtils';

interface AuditLogSectionProps {
  memberId: string;
}

function truncateValue(val: string | null, maxLen = 40): string {
  if (val === null) return '—';
  if (val.length <= maxLen) return val;
  return val.slice(0, maxLen) + '…';
}

export function AuditLogSection({ memberId }: AuditLogSectionProps) {
  const [data, setData] = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [tableFilter, setTableFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMemberAuditLog(memberId, {
        page,
        limit: 20,
        tableName: tableFilter || undefined,
      });
      setData(res);
    } catch {
      setError('Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }, [memberId, page, tableFilter]);

  useEffect(() => { void loadAuditLog(); }, [loadAuditLog]);

  const columns: TableColumn<AuditLogEntry>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      accessor: (row) => (
        <span className="text-xs text-neutral-600">{formatDateTime(row.createdAt)}</span>
      ),
      sortable: true,
      width: '160px',
    },
    {
      key: 'tableName',
      header: 'Table',
      accessor: (row) => (
        <span className="font-mono text-xs text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded">
          {row.tableName}
        </span>
      ),
    },
    {
      key: 'fieldName',
      header: 'Field',
      accessor: (row) => (
        <span className="font-mono text-xs text-neutral-600">{row.fieldName ?? '—'}</span>
      ),
    },
    {
      key: 'oldValue',
      header: 'Old value',
      accessor: (row) => (
        <span className="text-xs text-danger-fg/80" title={row.oldValue ?? ''}>
          {truncateValue(row.oldValue)}
        </span>
      ),
    },
    {
      key: 'newValue',
      header: 'New value',
      accessor: (row) => (
        <span className="text-xs text-success-fg" title={row.newValue ?? ''}>
          {truncateValue(row.newValue)}
        </span>
      ),
    },
    {
      key: 'changedBy',
      header: 'Changed by',
      accessor: (row) => (
        <span className="text-xs font-medium text-neutral-800">{row.changedBy}</span>
      ),
    },
  ];

  return (
    <section aria-labelledby="audit-heading">
      <h2 id="audit-heading" className="sr-only">Audit Log</h2>

      <div className="mb-4 flex items-end gap-3">
        <div className="w-56">
          <Input
            label="Filter by table"
            placeholder="e.g. members, payments"
            value={tableFilter}
            onChange={(e) => { setTableFilter(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <Skeleton variant="card" />
      ) : error ? (
        <Card>
          <p className="text-sm text-danger-fg">{error}</p>
          <Button variant="ghost" onClick={() => void loadAuditLog()} className="mt-2">
            Retry
          </Button>
        </Card>
      ) : (
        <>
          <Table
            columns={columns}
            data={data?.data ?? []}
            getRowId={(row) => row.id}
            emptyTitle="No audit entries"
            emptyMessage="No changes have been recorded for this member."
          />
          {data && data.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-neutral-600">
              <span>Page {page} of {data.totalPages} — {data.total} entries</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page === data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
