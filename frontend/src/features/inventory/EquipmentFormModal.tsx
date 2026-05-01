import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button, Input, Select } from '../../components/ui';
import { useToast } from '../../components/ui';
import { CheckIcon } from '../../components/ui/Icon';
import { createEquipment, updateEquipment } from './inventoryApi';
import type { EquipmentItem } from './inventoryApi';
import { getDisciplines } from '../members/api/membersApi';

export interface EquipmentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editItem?: EquipmentItem | null;
}

export function EquipmentFormModal({
  open,
  onClose,
  onSuccess,
  editItem,
}: EquipmentFormModalProps) {
  const toast = useToast();
  const isEdit = Boolean(editItem);

  const [name, setName] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [disciplineId, setDisciplineId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch disciplines for the dropdown
  const { data: disciplinesData } = useQuery({
    queryKey: ['disciplines'],
    queryFn: getDisciplines,
    staleTime: 5 * 60 * 1000,
  });

  const disciplineOptions = [
    { value: '', label: 'Aucune discipline' },
    ...(disciplinesData?.disciplines ?? [])
      .filter((d) => d.isActive)
      .map((d) => ({ value: d.id, label: d.name })),
  ];

  // Populate form when editing or reset when opening for create
  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setPriceInput(String(Math.round(editItem.price / 100)));
      setQuantityInput('');
      setDisciplineId(editItem.disciplineId ?? '');
    } else {
      setName('');
      setPriceInput('');
      setQuantityInput('');
      setDisciplineId('');
    }
    setErrors({});
  }, [editItem, open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Le nom est requis';
    const price = parseInt(priceInput.replace(/[^0-9]/g, ''), 10);
    if (!priceInput || isNaN(price) || price <= 0) {
      errs.price = 'Le prix doit etre superieur a 0';
    }
    if (!isEdit) {
      const qty = parseInt(quantityInput.replace(/[^0-9]/g, ''), 10);
      if (!quantityInput || isNaN(qty) || qty < 0) {
        errs.quantity = 'La quantite doit etre positive';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const price = parseInt(priceInput.replace(/[^0-9]/g, ''), 10) * 100;

    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        await updateEquipment(editItem.id, {
          name: name.trim(),
          price,
          disciplineId: disciplineId || null,
        });
        toast.show({
          type: 'success',
          title: 'Equipement mis a jour',
          description: `"${name.trim()}" a ete modifie avec succes.`,
        });
      } else {
        const stockQuantity = parseInt(quantityInput.replace(/[^0-9]/g, ''), 10);
        await createEquipment({
          name: name.trim(),
          price,
          stockQuantity,
          disciplineId: disciplineId || null,
        });
        toast.show({
          type: 'success',
          title: 'Equipement ajoute',
          description: `"${name.trim()}" a ete ajoute a l'inventaire.`,
        });
      }
      onSuccess();
      onClose();
    } catch {
      toast.show({
        type: 'error',
        title: isEdit ? 'Mise a jour echouee' : 'Ajout echoue',
        description: 'Impossible de sauvegarder. Veuillez reessayer.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier l\'equipement' : 'Ajouter un equipement'}
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
        {/* Name */}
        <Input
          label="Nom"
          placeholder="Ex: Kimono Judo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        {/* Price */}
        <Input
          label="Prix (DA)"
          type="text"
          inputMode="numeric"
          placeholder="Ex: 3500"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ''))}
          error={errors.price}
          helperText="Entrez le prix en dinars"
        />

        {/* Initial quantity - only for create */}
        {!isEdit && (
          <Input
            label="Quantite initiale"
            type="text"
            inputMode="numeric"
            placeholder="Ex: 20"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value.replace(/[^0-9]/g, ''))}
            error={errors.quantity}
          />
        )}

        {/* Discipline */}
        <Select
          label="Discipline"
          options={disciplineOptions}
          value={disciplineId}
          onChange={setDisciplineId}
          placeholder="Aucune discipline"
        />

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
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
