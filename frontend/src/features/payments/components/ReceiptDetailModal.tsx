import { Modal, Button } from '../../../components/ui';
import type { PaymentRecord } from '../paymentsApi';
import { paymentTypeToBadge } from './paymentBadgeMap';
import { printReceipt } from '../../../lib/print';
import { ReceiptPrintable } from './ReceiptPrintable';

export interface ReceiptDetailModalProps {
  open: boolean;
  payment: PaymentRecord | null;
  onClose: () => void;
}

export function ReceiptDetailModal({ open, payment, onClose }: ReceiptDetailModalProps) {
  if (!payment) return null;

  const badge = paymentTypeToBadge(payment.paymentType);

  return (
    <Modal open={open} onClose={onClose} title="Receipt Details" size="md">
      <ReceiptPrintable
        receiptNumber={payment.receiptNumber}
        createdAt={payment.createdAt}
        memberName={payment.memberName}
        items={payment.items}
        totalAmount={payment.totalAmount}
        paidAmount={payment.paidAmount}
        remaining={payment.remaining}
        notes={payment.notes}
        statusLabel={badge.label}
      />
      <div className="mt-4 flex justify-end gap-2 print:hidden">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" onClick={() => printReceipt()}>
          Print
        </Button>
      </div>
    </Modal>
  );
}
