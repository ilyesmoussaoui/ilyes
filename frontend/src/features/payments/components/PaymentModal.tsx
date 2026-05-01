import { useState, useCallback } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { useToast } from '../../../components/ui';
import {
  CreditCardIcon,
  SpinnerIcon,
  CheckIcon,
} from '../../../components/ui/Icon';
import { createPayment, type PaymentRecord } from '../paymentsApi';
import type { PaymentLineItem } from '../paymentsApi';
import { formatDZD, parseDZDInput } from '../utils';
import { printReceipt } from '../../../lib/print';
import { ReceiptPrintable } from './ReceiptPrintable';

type PaymentOption = 'full' | 'partial' | 'later';

export interface PaymentModalProps {
  open: boolean;
  memberId: string;
  memberName: string;
  items: PaymentLineItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({
  open,
  memberId,
  memberName,
  items,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const toast = useToast();

  const [paymentOption, setPaymentOption] = useState<PaymentOption>('full');
  const [partialInput, setPartialInput] = useState('');
  const [partialError, setPartialError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState<PaymentRecord | null>(null);

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const computePaid = useCallback((): number => {
    if (paymentOption === 'full') return totalAmount;
    if (paymentOption === 'later') return 0;
    return parseDZDInput(partialInput);
  }, [paymentOption, partialInput, totalAmount]);

  const paidAmount = computePaid();
  const remaining = totalAmount - paidAmount;

  const validatePartial = (value: string): boolean => {
    const amount = parseDZDInput(value);
    if (amount <= 0) {
      setPartialError('Amount must be greater than 0');
      return false;
    }
    if (amount >= totalAmount) {
      setPartialError('Partial amount must be less than total');
      return false;
    }
    setPartialError(null);
    return true;
  };

  const handlePartialChange = (value: string) => {
    // Only allow digits
    const cleaned = value.replace(/[^0-9]/g, '');
    setPartialInput(cleaned);
    if (cleaned) {
      validatePartial(cleaned);
    } else {
      setPartialError(null);
    }
  };

  const handleSubmit = async () => {
    if (paymentOption === 'partial' && !validatePartial(partialInput)) {
      return;
    }

    setSubmitting(true);
    try {
      const payment = await createPayment({
        memberId,
        items,
        paymentType: paymentOption,
        paidAmount: computePaid(),
      });
      setConfirmedPayment(payment);
      toast.show({
        type: 'success',
        title: 'Payment recorded',
        description: `Receipt #${payment.receiptNumber} for ${memberName} created.`,
      });
      onSuccess();
    } catch {
      toast.show({
        type: 'error',
        title: 'Payment failed',
        description: 'Could not process payment. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    printReceipt();
  };

  const isSubmitDisabled =
    submitting ||
    (paymentOption === 'partial' && (parseDZDInput(partialInput) <= 0 || parseDZDInput(partialInput) >= totalAmount));

  return (
    <Modal open={open} onClose={onClose} title="Record Payment" size="lg">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Left: Payment Options */}
        <div className="flex-1 space-y-5">
          {/* Line Items Summary */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Items for {memberName}
            </h3>
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm"
                >
                  <span className="text-neutral-700">{item.description}</span>
                  <span className="font-medium text-neutral-900">
                    {formatDZD(item.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-200 px-3 pt-2">
              <span className="text-sm font-semibold text-neutral-800">Total</span>
              <span className="text-base font-bold text-neutral-900">
                {formatDZD(totalAmount)}
              </span>
            </div>
          </div>

          {/* Payment Option Selection */}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-neutral-700">
              Payment Method
            </legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={paymentOption === opt.value}
                  onClick={() => {
                    setPaymentOption(opt.value);
                    setPartialError(null);
                  }}
                  className={`flex flex-1 items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    paymentOption === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      paymentOption === opt.value
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-neutral-300'
                    }`}
                  >
                    {paymentOption === opt.value && (
                      <CheckIcon size={12} className="text-white" />
                    )}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Partial Amount Input */}
          {paymentOption === 'partial' && (
            <div className="animate-fade-in">
              <Input
                label="Amount to pay (DZD)"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1500"
                value={partialInput}
                onChange={(e) => handlePartialChange(e.target.value)}
                error={partialError}
                helperText={
                  partialInput && !partialError
                    ? `Remaining: ${formatDZD(totalAmount - parseDZDInput(partialInput))}`
                    : undefined
                }
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
            <Button
              variant="primary"
              iconLeft={submitting ? <SpinnerIcon size={16} /> : <CreditCardIcon size={16} />}
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

        {/* Right: Receipt Preview / Confirmation */}
        <div className="w-full shrink-0 lg:w-80">
          {confirmedPayment ? (
            <div className="rounded-lg border border-success/30 bg-success-bg/40 p-4">
              <ReceiptPrintable
                receiptNumber={confirmedPayment.receiptNumber}
                createdAt={confirmedPayment.createdAt}
                memberName={confirmedPayment.memberName}
                items={confirmedPayment.items}
                totalAmount={confirmedPayment.totalAmount}
                paidAmount={confirmedPayment.paidAmount}
                remaining={confirmedPayment.remaining}
                notes={confirmedPayment.notes}
              />
              <Button
                variant="secondary"
                fullWidth
                className="mt-3 print:hidden"
                onClick={handlePrint}
              >
                Print Receipt
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
              <p className="font-semibold text-neutral-800">{memberName}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {items.length} item{items.length === 1 ? '' : 's'}
              </p>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-semibold">{formatDZD(totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paying now</span>
                  <span className="font-semibold text-primary-700">
                    {formatDZD(paidAmount)}
                  </span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-danger">
                    <span>Remaining</span>
                    <span className="font-semibold">{formatDZD(remaining)}</span>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                The receipt — with your club branding — will appear here after you
                confirm the payment, ready to print.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

const PAYMENT_OPTIONS: { value: PaymentOption; label: string }[] = [
  { value: 'full', label: 'Full Payment' },
  { value: 'partial', label: 'Partial' },
  { value: 'later', label: 'Pay Later' },
];
