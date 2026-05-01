import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, Modal, ConfirmModal, Badge } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { Skeleton } from '../../components/ui/Skeleton';
import { PlusIcon, EditIcon, TrashIcon } from '../../components/ui/Icon';
import { Icon } from '../../components/ui';
import {
  fetchPricing,
  fetchDisciplines,
  fetchFeeSettings,
  updateFeeSettings,
  createPlan,
  updatePlan,
  deletePlan,
  type PricingPlan,
  type PricingGroup,
  type Discipline,
} from './settingsApi';
import { ApiError } from '../../lib/api';

// ── Fees Section ──────────────────────────────────────────────────────

const FEE_VALIDATION_MAX = 10_000_000; // centimes (100,000 DZD)

interface FeeFormState {
  registrationFee: string; // DZD (display)
  licenseFee: string;
  extraSessionPrice: string;
}

function FeesSection() {
  const toast = useToast();
  const [loadingFees, setLoadingFees] = useState(true);
  const [savingFees, setSavingFees] = useState(false);
  const [feeForm, setFeeForm] = useState<FeeFormState>({
    registrationFee: '',
    licenseFee: '',
    extraSessionPrice: '',
  });
  const [feeErrors, setFeeErrors] = useState<Partial<FeeFormState>>({});

  useEffect(() => {
    let cancelled = false;
    fetchFeeSettings()
      .then((data) => {
        if (cancelled) return;
        setFeeForm({
          registrationFee: String(Math.round(data.registrationFee / 100)),
          licenseFee: String(Math.round(data.licenseFee / 100)),
          extraSessionPrice: String(Math.round(data.extraSessionPrice / 100)),
        });
      })
      .catch(() => {
        // silently leave form empty — user can fill it in
      })
      .finally(() => {
        if (!cancelled) setLoadingFees(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleFeeChange = (field: keyof FeeFormState, value: string) => {
    setFeeForm((prev) => ({ ...prev, [field]: value }));
    setFeeErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateFeeField = (raw: string, label: string): string | undefined => {
    const n = Number(raw);
    if (!raw.trim() || isNaN(n) || !Number.isInteger(n) || n < 0) {
      return `${label} must be a non-negative whole number`;
    }
    if (n * 100 > FEE_VALIDATION_MAX) {
      return `${label} must not exceed ${FEE_VALIDATION_MAX / 100} DZD`;
    }
    return undefined;
  };

  const handleSaveFees = async () => {
    const errors: Partial<FeeFormState> = {
      registrationFee: validateFeeField(feeForm.registrationFee, 'Registration Fee'),
      licenseFee: validateFeeField(feeForm.licenseFee, 'License Fee'),
      extraSessionPrice: validateFeeField(feeForm.extraSessionPrice, 'Extra Session Price'),
    };
    const hasErrors = Object.values(errors).some(Boolean);
    setFeeErrors(errors);
    if (hasErrors) return;

    setSavingFees(true);
    try {
      const result = await updateFeeSettings({
        registrationFee: Math.round(Number(feeForm.registrationFee) * 100),
        licenseFee: Math.round(Number(feeForm.licenseFee) * 100),
        extraSessionPrice: Math.round(Number(feeForm.extraSessionPrice) * 100),
      });
      // Sync state from server response (source of truth)
      setFeeForm({
        registrationFee: String(Math.round(result.fees.registrationFee / 100)),
        licenseFee: String(Math.round(result.fees.licenseFee / 100)),
        extraSessionPrice: String(Math.round(result.fees.extraSessionPrice / 100)),
      });
      toast.show({ type: 'success', title: 'Fees saved', description: 'Fee settings have been updated.' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save fees';
      toast.show({ type: 'error', title: 'Save failed', description: message });
    } finally {
      setSavingFees(false);
    }
  };

  if (loadingFees) {
    return (
      <Card title="Fees">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton variant="block" height="56px" />
          <Skeleton variant="block" height="56px" />
          <Skeleton variant="block" height="56px" />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Fees">
      <p className="mb-4 text-sm text-neutral-500">
        Enter amounts in DZD. Values are stored as centimes internally.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Registration Fee (DZD)"
          type="number"
          min="0"
          step="1"
          value={feeForm.registrationFee}
          onChange={(e) => handleFeeChange('registrationFee', e.target.value)}
          error={feeErrors.registrationFee}
          placeholder="e.g. 500"
        />
        <Input
          label="License Fee (DZD)"
          type="number"
          min="0"
          step="1"
          value={feeForm.licenseFee}
          onChange={(e) => handleFeeChange('licenseFee', e.target.value)}
          error={feeErrors.licenseFee}
          placeholder="e.g. 1200"
        />
        <Input
          label="Extra Session Price (DZD)"
          type="number"
          min="0"
          step="1"
          value={feeForm.extraSessionPrice}
          onChange={(e) => handleFeeChange('extraSessionPrice', e.target.value)}
          error={feeErrors.extraSessionPrice}
          placeholder="e.g. 750"
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={handleSaveFees} loading={savingFees}>
          Save Fees
        </Button>
      </div>
    </Card>
  );
}

const PLAN_TYPES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'session_pack', label: 'Session Pack' },
];

function formatDZD(centimes: number): string {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(centimes / 100));
}

function planTypeLabel(type: string): string {
  return PLAN_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface PlanFormState {
  disciplineId: string;
  planType: string;
  amountDZD: string; // Display value in DZD
}

const EMPTY_FORM: PlanFormState = {
  disciplineId: '',
  planType: '',
  amountDZD: '',
};

export function PricingSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pricingGroups, setPricingGroups] = useState<PricingGroup[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);

  // Modal state – editingPlan needs discipline context for display
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<(PricingPlan & { disciplineId: string }) | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<(PricingPlan & { disciplineId: string }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<(PricingPlan & { disciplineId: string }) | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pricingData, disciplinesData] = await Promise.all([
        fetchPricing(),
        fetchDisciplines(),
      ]);
      setPricingGroups(pricingData.pricing);
      setDisciplines(disciplinesData.disciplines);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load pricing';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const disciplineOptions = disciplines
    .filter((d) => d.isActive)
    .map((d) => ({ value: d.id, label: d.name }));

  const openCreate = (disciplineId?: string) => {
    setEditingPlan(null);
    setForm({
      ...EMPTY_FORM,
      disciplineId: disciplineId ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (plan: PricingPlan, disciplineId: string) => {
    setEditingPlan({ ...plan, disciplineId });
    setForm({
      disciplineId,
      planType: plan.planType,
      amountDZD: String(Math.round(plan.amount / 100)),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!editingPlan && !form.disciplineId) errors.disciplineId = 'Discipline is required';
    if (!editingPlan && !form.planType) errors.planType = 'Plan type is required';

    const amountNum = Number(form.amountDZD);
    if (!form.amountDZD || isNaN(amountNum) || amountNum <= 0) {
      errors.amountDZD = 'Enter a valid amount';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const centimes = Math.round(amountNum * 100);
    setSubmitting(true);

    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, { amount: centimes });
        toast.show({
          type: 'success',
          title: 'Plan updated',
          description: 'Changes only affect new subscriptions.',
        });
      } else {
        await createPlan({
          disciplineId: form.disciplineId,
          planType: form.planType,
          amount: centimes,
        });
        toast.show({ type: 'success', title: 'Plan created' });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Operation failed';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const newActive = !toggleTarget.isActive;
      await updatePlan(toggleTarget.id, { isActive: newActive });
      toast.show({
        type: 'success',
        title: newActive ? 'Plan activated' : 'Plan deactivated',
      });
      load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Operation failed';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setToggling(false);
      setToggleTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePlan(deleteTarget.id);
      toast.show({ type: 'success', title: 'Plan deleted' });
      load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete plan';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" lines={1} width="200px" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-800">Failed to load pricing</p>
          <p className="text-xs text-neutral-500">{error}</p>
          <Button variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fees Section */}
      <FeesSection />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Subscription Plans</h2>
          <p className="text-sm text-neutral-600">
            Manage subscription plans and pricing for each discipline.
          </p>
        </div>
        <Button variant="primary" onClick={() => openCreate()} iconLeft={<PlusIcon size={16} />}>
          Add Plan
        </Button>
      </div>

      {/* Grouped by discipline */}
      {pricingGroups.map((group) => (
        <Card key={group.disciplineId} title={group.disciplineName} action={
          <Button
            variant="ghost"
            onClick={() => openCreate(group.disciplineId)}
            iconLeft={<PlusIcon size={14} />}
          >
            Add Plan
          </Button>
        }>
          <div className="divide-y divide-neutral-100">
            {group.plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <Icon name="credit-card" size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900">
                      {planTypeLabel(plan.planType)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDZD(plan.amount)} DZD
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={plan.isActive ? 'active' : 'inactive'} />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(plan, group.disciplineId)}
                      aria-label={`Edit ${planTypeLabel(plan.planType)}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
                    >
                      <EditIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToggleTarget({ ...plan, disciplineId: group.disciplineId })}
                      aria-label={plan.isActive ? 'Deactivate' : 'Activate'}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-warning-fg"
                    >
                      <Icon name={plan.isActive ? 'toggle-right' : 'toggle-left'} size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ ...plan, disciplineId: group.disciplineId })}
                      aria-label={`Delete ${planTypeLabel(plan.planType)}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-danger-bg hover:text-danger"
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {pricingGroups.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Icon name="credit-card" size={28} className="text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-800">No pricing plans</p>
            <p className="text-xs text-neutral-500">
              Add subscription plans for your disciplines.
            </p>
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? 'Edit Plan' : 'Add Plan'}
        size="sm"
      >
        <div className="space-y-4">
          {!editingPlan && (
            <>
              <Select
                label="Discipline"
                options={disciplineOptions}
                value={form.disciplineId}
                onChange={(val) => setForm((p) => ({ ...p, disciplineId: val }))}
                error={formErrors.disciplineId}
                placeholder="Select discipline..."
              />
              <Select
                label="Plan Type"
                options={PLAN_TYPES}
                value={form.planType}
                onChange={(val) => setForm((p) => ({ ...p, planType: val }))}
                error={formErrors.planType}
                placeholder="Select plan type..."
              />
            </>
          )}
          <Input
            label="Amount (DZD)"
            type="number"
            value={form.amountDZD}
            onChange={(e) => setForm((p) => ({ ...p, amountDZD: e.target.value }))}
            error={formErrors.amountDZD}
            placeholder="e.g. 5000"
            helperText={editingPlan ? 'Changes only affect new subscriptions.' : undefined}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {editingPlan ? 'Save' : 'Create'}
          </Button>
        </div>
      </Modal>

      {/* Toggle */}
      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.isActive ? 'Deactivate Plan' : 'Activate Plan'}
        message={
          toggleTarget?.isActive
            ? `Deactivate this ${planTypeLabel(toggleTarget.planType)} plan? It won't be available for new subscriptions.`
            : `Activate this ${planTypeLabel(toggleTarget?.planType ?? '')} plan?`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        destructive={!!toggleTarget?.isActive}
        loading={toggling}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Plan"
        message={`Are you sure you want to delete this ${planTypeLabel(deleteTarget?.planType ?? '')} plan? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
      />
    </div>
  );
}
