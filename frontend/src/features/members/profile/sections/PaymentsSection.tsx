import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Badge, Skeleton, Modal } from '../../../../components/ui';
import type { PaymentInfo, MemberProfile, PaginatedResponse } from '../profileTypes';
import type { TableColumn } from '../../../../types/ui';
import { getMemberPayments } from '../profileApi';
import { formatMoney, formatDate } from '../profileUtils';
import { EyeIcon } from '../../../../components/ui/Icon';

interface PaymentsSectionProps {
  profile: MemberProfile;
}

function paymentStatusVariant(payment: PaymentInfo): 'paid' | 'partial' | 'unpaid' {
  if (payment.remaining === 0) return 'paid';
  if (payment.paid > 0) return 'partial';
  return 'unpaid';
}

function ReceiptModal({ payment, onClose }: { payment: PaymentInfo | null; onClose: () => void }) {
  if (!payment) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={payment.receiptNo ? `Receipt #${payment.receiptNo}` : 'Payment Detail'}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Date</p>
            <p className="mt-0.5 text-neutral-900">{formatDate(payment.date)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Type</p>
            <p className="mt-0.5 capitalize text-neutral-900">{payment.type}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Status</p>
            <div className="mt-0.5">
              <Badge variant={paymentStatusVariant(payment)} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Receipt #</p>
            <p className="mt-0.5 font-mono text-xs text-neutral-700">{payment.receiptNo ?? '—'}</p>
          </div>
        </div>

        {payment.items.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Items</p>
            <ul className="flex flex-col gap-1.5 rounded-md border border-neutral-100 bg-neutral-50 p-3">
              {payment.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-neutral-700">{item.description}</span>
                  <span className="font-medium text-neutral-900">{formatMoney(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">Total</span>
            <span className="font-semibold text-neutral-900">{formatMoney(payment.total)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-neutral-600">Paid</span>
            <span className="font-medium text-success-fg">{formatMoney(payment.paid)}</span>
          </div>
          {payment.remaining > 0 && (
            <div className="mt-1.5 flex items-center justify-between border-t border-neutral-100 pt-1.5 text-sm">
              <span className="font-medium text-danger-fg">Remaining</span>
              <span className="font-semibold text-danger-fg">{formatMoney(payment.remaining)}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function PaymentsSection({ profile }: PaymentsSectionProps) {
  const [tableData, setTableData] = useState<PaginatedResponse<PaymentInfo> | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentInfo | null>(null);

  const loadPayments = useCallback(async () => {
    setTableLoading(true);
    setTableError(null);
    try {
      const res = await getMemberPayments(profile.id, { page: tablePage, limit: 15 });
      setTableData(res);
    } catch {
      setTableError('Failed to load payment history.');
    } finally {
      setTableLoading(false);
    }
  }, [profile.id, tablePage]);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  const activeSub = profile.subscriptions.find((s) => s.status.toLowerCase() === 'active');
  const unpaidPayments = profile.payments.filter((p) => p.remaining > 0);

  const columns: TableColumn<PaymentInfo>[] = [
    {
      key: 'receiptNo',
      header: 'Receipt #',
      accessor: (row) => (
        <span className="font-mono text-xs text-neutral-600">{row.receiptNo ?? '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (row) => formatDate(row.date),
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      accessor: (row) => (
        <span className="capitalize text-neutral-700">{row.type}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      accessor: (row) => formatMoney(row.total),
      align: 'right',
      sortable: true,
    },
    {
      key: 'paid',
      header: 'Paid',
      accessor: (row) => (
        <span className="text-success-fg font-medium">{formatMoney(row.paid)}</span>
      ),
      align: 'right',
    },
    {
      key: 'remaining',
      header: 'Remaining',
      accessor: (row) => (
        row.remaining > 0 ? (
          <span className="font-medium text-danger-fg">{formatMoney(row.remaining)}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        )
      ),
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => (
        <Badge variant={paymentStatusVariant(row)} />
      ),
    },
    {
      key: 'actions',
      header: '',
      accessor: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelectedPayment(row); }}
          aria-label={`View receipt for payment ${row.receiptNo ?? ''}`}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-primary-50 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <EyeIcon size={12} />
          View
        </button>
      ),
    },
  ];

  return (
    <section aria-labelledby="payments-heading" className="flex flex-col gap-4">
      <h2 id="payments-heading" className="sr-only">Payments</h2>

      {/* Balance card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Outstanding Balance</p>
          <p className={`mt-1 text-2xl font-bold ${profile.balance > 0 ? 'text-danger-fg' : 'text-success-fg'}`}>
            {formatMoney(profile.balance)}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Subscription</p>
          <div className="mt-1">
            {activeSub ? (
              <>
                <p className="text-sm font-semibold text-neutral-900">{activeSub.planName}</p>
                <p className="text-xs text-neutral-500">
                  Auto-renew: {activeSub.autoRenew ? 'Yes' : 'No'}
                </p>
              </>
            ) : (
              <span className="text-sm text-neutral-400">No active subscription</span>
            )}
          </div>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Unpaid Invoices</p>
          <p className={`mt-1 text-2xl font-bold ${unpaidPayments.length > 0 ? 'text-warning-fg' : 'text-success-fg'}`}>
            {unpaidPayments.length}
          </p>
        </Card>
      </div>

      {/* Unpaid highlighted */}
      {unpaidPayments.length > 0 && (
        <div className="rounded-lg border border-danger/20 bg-danger-bg p-4">
          <p className="mb-2 text-sm font-semibold text-danger-fg">Unpaid fees</p>
          <ul className="flex flex-col gap-2">
            {unpaidPayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-neutral-700">{formatDate(p.date)} — {p.type}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-danger-fg">{formatMoney(p.remaining)} remaining</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPayment(p)}
                    className="rounded-md border border-danger/20 px-2 py-0.5 text-xs font-medium text-danger-fg hover:bg-danger-bg/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                  >
                    Pay
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Payment table */}
      {tableLoading ? (
        <Skeleton variant="card" />
      ) : tableError ? (
        <Card>
          <p className="text-sm text-danger-fg">{tableError}</p>
          <Button variant="ghost" onClick={() => void loadPayments()} className="mt-2">Retry</Button>
        </Card>
      ) : (
        <>
          <Table
            columns={columns}
            data={tableData?.data ?? []}
            getRowId={(row) => row.id}
            emptyTitle="No payments"
            emptyMessage="No payment records found for this member."
            onRowClick={(row) => setSelectedPayment(row)}
          />
          {tableData && tableData.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-neutral-600">
              <span>Page {tablePage} of {tableData.totalPages}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={tablePage === 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={tablePage === tableData.totalPages}
                  onClick={() => setTablePage((p) => Math.min(tableData.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ReceiptModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
    </section>
  );
}
