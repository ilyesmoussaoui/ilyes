import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, Select } from '../../components/ui';
import { useToast } from '../../components/ui';
import {
  CheckIcon,
  PaperclipIcon,
  XIcon,
  UploadIcon,
} from '../../components/ui/Icon';
import {
  EXPENSE_CATEGORIES,
  createExpense,
  updateExpense,
  uploadExpenseReceipt,
  getReceiptUrl,
} from './expensesApi';
import type { ExpenseRecord, ExpenseCategory } from './expensesApi';

export interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editExpense?: ExpenseRecord | null;
}

const categoryOptions = EXPENSE_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
}));

const ACCEPT_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

export function ExpenseFormModal({
  open,
  onClose,
  onSuccess,
  editExpense,
}: ExpenseFormModalProps) {
  const toast = useToast();
  const isEdit = Boolean(editExpense);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState('');
  const [category, setCategory] = useState<string>('');
  const [amountInput, setAmountInput] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Receipt file state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null);
  const [clearExistingReceipt, setClearExistingReceipt] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editExpense) {
      setDate(editExpense.date.slice(0, 10));
      setCategory(editExpense.category);
      setAmountInput(String(Math.round(editExpense.amount / 100)));
      setDescription(editExpense.description ?? '');
      setExistingReceiptPath(editExpense.receiptPath);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setCategory('');
      setAmountInput('');
      setDescription('');
      setExistingReceiptPath(null);
    }
    setReceiptFile(null);
    setClearExistingReceipt(false);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [editExpense, open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Date is required';
    if (!category) errs.category = 'Category is required';
    const amount = parseInt(amountInput.replace(/[^0-9]/g, ''), 10);
    if (!amountInput || isNaN(amount) || amount <= 0) {
      errs.amount = 'Amount must be greater than 0';
    }
    if (receiptFile && receiptFile.size > MAX_BYTES) {
      errs.receipt = 'Receipt file must be under 5MB';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, receipt: 'File exceeds 5MB limit' }));
      setReceiptFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setErrors((prev) => {
      const { receipt: _r, ...rest } = prev;
      return rest;
    });
    setReceiptFile(file);
  };

  const handleRemoveNewFile = () => {
    setReceiptFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearExisting = () => {
    setClearExistingReceipt(true);
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const amount = parseInt(amountInput.replace(/[^0-9]/g, ''), 10) * 100;
    const trimmedDesc = description.trim();

    setSubmitting(true);
    try {
      let targetExpenseId: string;

      if (isEdit && editExpense) {
        const updated = await updateExpense(editExpense.id, {
          date,
          category: category as ExpenseCategory,
          amount,
          description: trimmedDesc || null,
          // If user explicitly cleared the existing receipt and didn't upload a new one
          ...(clearExistingReceipt && !receiptFile
            ? { receiptPath: null }
            : {}),
        });
        targetExpenseId = updated.id;
      } else {
        const created = await createExpense({
          date,
          category: category as ExpenseCategory,
          amount,
          description: trimmedDesc,
        });
        targetExpenseId = created.id;
      }

      // Upload new receipt if provided
      if (receiptFile) {
        await uploadExpenseReceipt(targetExpenseId, receiptFile);
      }

      toast.show({
        type: 'success',
        title: isEdit ? 'Expense updated' : 'Expense added',
        description: isEdit
          ? 'The expense record has been updated.'
          : 'New expense has been recorded.',
      });
      onSuccess();
      onClose();
    } catch {
      toast.show({
        type: 'error',
        title: isEdit ? 'Update failed' : 'Creation failed',
        description: 'Could not save expense. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const showingExistingReceipt =
    isEdit && existingReceiptPath && !clearExistingReceipt && !receiptFile;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Expense' : 'Add Expense'}
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="space-y-4"
        noValidate
      >
        {/* Date */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="expense-date"
            className="text-sm font-medium text-neutral-700"
          >
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`h-10 w-full rounded-md border bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-200 ${
              errors.date
                ? 'border-danger focus:border-danger'
                : 'border-neutral-300 focus:border-primary-500'
            }`}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? 'expense-date-err' : undefined}
          />
          {errors.date && (
            <p id="expense-date-err" className="text-xs text-danger">
              {errors.date}
            </p>
          )}
        </div>

        {/* Category */}
        <Select
          label="Category"
          options={categoryOptions}
          value={category}
          onChange={setCategory}
          placeholder="Select category..."
          error={errors.category}
        />

        {/* Amount */}
        <Input
          label="Amount (DZD)"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 5000"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
          error={errors.amount}
          helperText="Enter amount in whole dinars"
        />

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="expense-desc"
            className="text-sm font-medium text-neutral-700"
          >
            Description{' '}
            <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="expense-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this expense for?"
            className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 ${
              errors.description
                ? 'border-danger focus:border-danger'
                : 'border-neutral-300 focus:border-primary-500'
            }`}
            aria-invalid={Boolean(errors.description)}
          />
        </div>

        {/* Receipt upload */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">
            Receipt{' '}
            <span className="font-normal text-neutral-400">
              (optional, PDF/JPG/PNG, max 5MB)
            </span>
          </label>

          {showingExistingReceipt ? (
            <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <PaperclipIcon size={14} className="shrink-0 text-neutral-500" />
              <a
                href={getReceiptUrl(existingReceiptPath!)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-primary-600 hover:underline"
              >
                {existingReceiptPath}
              </a>
              <button
                type="button"
                onClick={handleClearExisting}
                className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                aria-label="Remove existing receipt"
              >
                <XIcon size={12} />
              </button>
            </div>
          ) : receiptFile ? (
            <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <PaperclipIcon size={14} className="shrink-0 text-neutral-500" />
              <span className="flex-1 truncate text-sm text-neutral-700">
                {receiptFile.name}
              </span>
              <span className="text-xs text-neutral-500">
                {(receiptFile.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={handleRemoveNewFile}
                className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                aria-label="Remove selected file"
              >
                <XIcon size={12} />
              </button>
            </div>
          ) : (
            <div>
              <label
                htmlFor="expense-receipt"
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed bg-white px-4 py-6 text-sm transition-colors hover:bg-neutral-50 ${
                  errors.receipt
                    ? 'border-danger text-danger-fg'
                    : 'border-neutral-300 text-neutral-600'
                }`}
              >
                <UploadIcon size={16} />
                <span>Click to upload receipt</span>
                <input
                  id="expense-receipt"
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_TYPES}
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {clearExistingReceipt && (
                <p className="mt-1 text-xs text-neutral-500">
                  Existing receipt will be removed on save.
                </p>
              )}
            </div>
          )}

          {errors.receipt && (
            <p className="text-xs text-danger">{errors.receipt}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            iconLeft={<CheckIcon size={16} />}
          >
            {isEdit ? 'Update Expense' : 'Add Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
