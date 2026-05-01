import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { useToast } from '../../../components/ui';
import {
  CreditCardIcon,
  SpinnerIcon,
  AlertIcon,
} from '../../../components/ui/Icon';
import { collectMemberPayment } from '../paymentsApi';
import type { CollectPaymentResponse } from '../paymentsApi';
import { formatDZD, parseDZDInput } from '../utils';

export interface CollectPaymentModalProps {
  open: boolean;
  memberId: string;
  memberName: string;
  outstandingBalance: number; // centimes
  onClose: () => void;
  onSuccess: (result: CollectPaymentResponse) => void;
}

export function CollectPaymentModal({
  open,
  memberId,
  memberName,
  outstandingBalance,
  onClose,
  onSuccess,
}: CollectPaymentModalProps) {
  const toast = useToast();
  const [amountInput, setAmountInput] = useState('');
  const [notes, setNotes] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmountInput(String(Math.round(outstandingBalance / 100)));
      setNotes('');
      setAmountError(null);
      setSubmitError(null);
    }
  }, [open, outstandingBalance]);

  const amountCentimes = parseDZDInput(amountInput);
  const remainingAfter = Math.max(0, outstandingBalance - amountCentimes);

  const validate = (): boolean => {
    if (amountCentimes <= 0) {
      setAmountError('Amount must be greater than 0');
      return false;
    }
    if (amountCentimes > outstandingBalance) {
      setAmountError('Amount cannot exceed outstanding balance');
      return false;
    }
    setAmountError(null);
    return true;
  };

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setAmountInput(cleaned);
    if (cleaned) {
      const centimes = parseDZDInput(cleaned);
      if (centimes <= 0) {
        setAmountError('Amount must be greater than 0');
      } else if (centimes > outstandingBalance) {
        setAmountError('Amount cannot exceed outstanding balance');
      } else {
        setAmountError(null);
      }
    } else {
      setAmountError(null);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await collectMemberPayment(memberId, {
        amount: amountCentimes,
        notes: notes.trim() || undefined,
      });
      toast.show({
        type: 'success',
        title: 'Payment recorded',
        description: `${formatDZD(result.applied)} applied. ${formatDZD(result.remainingBalance)} remaining.`,
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not record payment.';
      setSubmitError(message);
      toast.show({
        type: 'error',
        title: 'Payment failed',
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled =
    submitting ||
    amountCentimes <= 0 ||
    amountCentimes > outstandingBalance ||
    outstandingBalance === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      description={`Apply a payment to ${memberName}'s outstanding balance`}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {/* Outstanding balance summary */}
        <div className="rounded-lg border border-danger/20 bg-danger-bg/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-danger-fg/70">
              Outstanding balance
            </span>
            <span className="text-base font-bold text-danger-fg">
              {formatDZD(outstandingBalance)}
            </span>
          </div>
        </div>

        {/* Amount input */}
        <Input
          label="Amount to collect (DZD)"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 1500"
          value={amountInput}
          onChange={(e) => handleAmountChange(e.target.value)}
          error={amountError}
          helperText={
            !amountError && amountCentimes > 0
              ? `Remaining after this payment: ${formatDZD(remainingAfter)}`
              : undefined
          }
          autoFocus
        />

        {/* Optional notes */}
        <Input
          label="Notes (optional)"
          type="text"
          placeholder="Cash payment, bank transfer, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />

        {/* Submit error */}
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
          >
            <AlertIcon size={14} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Info: FIFO */}
        <p className="text-xs text-neutral-500">
          This amount will be applied to the oldest unpaid receipts first.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <Button
            variant="primary"
            iconLeft={
              submitting ? <SpinnerIcon size={16} /> : <CreditCardIcon size={16} />
            }
            onClick={() => void handleSubmit()}
            disabled={isSubmitDisabled}
            loading={submitting}
          >
            Confirm Payment
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
