import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../components/ui';
import { useToast } from '../../components/ui';
import { CheckIcon } from '../../components/ui/Icon';
import { adjustStock } from './inventoryApi';
import type { EquipmentItem, StockAdjustmentReason } from './inventoryApi';

export interface StockAdjustModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: EquipmentItem | null;
}

const REASON_OPTIONS: { value: StockAdjustmentReason; label: string }[] = [
  { value: 'manual_add', label: 'Ajout manuel' },
  { value: 'manual_remove', label: 'Retrait manuel' },
  { value: 'correction', label: 'Correction' },
  { value: 'initial_stock', label: 'Stock initial' },
];

type AdjustDirection = 'add' | 'remove';

export function StockAdjustModal({
  open,
  onClose,
  onSuccess,
  item,
}: StockAdjustModalProps) {
  const toast = useToast();

  const [direction, setDirection] = useState<AdjustDirection>('add');
  const [quantityInput, setQuantityInput] = useState('');
  const [reason, setReason] = useState<StockAdjustmentReason>('manual_add');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when opening
  useEffect(() => {
    setDirection('add');
    setQuantityInput('');
    setReason('manual_add');
    setNotes('');
    setErrors({});
  }, [open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const qty = parseInt(quantityInput.replace(/[^0-9]/g, ''), 10);
    if (!quantityInput || isNaN(qty) || qty <= 0) {
      errs.quantity = 'La quantite doit etre superieure a 0';
    }
    if (direction === 'remove' && item && qty > item.stockQuantity) {
      errs.quantity = `Stock insuffisant (disponible: ${item.stockQuantity})`;
    }
    if (!reason) errs.reason = 'La raison est requise';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!item || !validate()) return;

    const qty = parseInt(quantityInput.replace(/[^0-9]/g, ''), 10);
    const quantityChange = direction === 'add' ? qty : -qty;

    setSubmitting(true);
    try {
      await adjustStock(item.id, {
        quantityChange,
        reason,
        notes: notes.trim() || undefined,
      });
      toast.show({
        type: 'success',
        title: 'Stock ajuste',
        description: `${direction === 'add' ? '+' : '-'}${qty} pour "${item.name}".`,
      });
      onSuccess();
      onClose();
    } catch {
      toast.show({
        type: 'error',
        title: 'Ajustement echoue',
        description: 'Impossible d\'ajuster le stock. Veuillez reessayer.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajuster le stock"
      description={`${item.name} - Stock actuel: ${item.stockQuantity}`}
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
        {/* Direction toggle */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-neutral-700">
            Type d&apos;ajustement
          </legend>
          <div className="flex gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'add'}
              onClick={() => setDirection('add')}
              className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                direction === 'add'
                  ? 'border-success bg-success-bg text-success-fg'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              + Ajouter
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'remove'}
              onClick={() => setDirection('remove')}
              className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                direction === 'remove'
                  ? 'border-danger bg-danger-bg text-danger-fg'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              - Retirer
            </button>
          </div>
        </fieldset>

        {/* Quantity */}
        <Input
          label="Quantite"
          type="text"
          inputMode="numeric"
          placeholder="Ex: 5"
          value={quantityInput}
          onChange={(e) => setQuantityInput(e.target.value.replace(/[^0-9]/g, ''))}
          error={errors.quantity}
        />

        {/* Reason */}
        <Select
          label="Raison"
          options={REASON_OPTIONS}
          value={reason}
          onChange={(v) => setReason(v as StockAdjustmentReason)}
          placeholder="Selectionnez une raison..."
          error={errors.reason}
        />

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="adjust-notes"
            className="text-sm font-medium text-neutral-700"
          >
            Notes (optionnel)
          </label>
          <textarea
            id="adjust-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Details supplementaires..."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            iconLeft={<CheckIcon size={16} />}
          >
            Confirmer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
