import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Input, Select } from '../../../components/ui';
import { useToast } from '../../../components/ui';
import { AlertIcon } from '../../../components/ui/Icon';
import {
  createTimeSlot,
  updateTimeSlot,
  checkConflicts,
  getDisciplines,
  getCoaches,
} from '../sessionsApi';
import type { TimeSlot, TimeSlotWarning } from '../sessionsApi';

const DAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

interface SessionFormModalProps {
  open: boolean;
  onClose: () => void;
  editSlot?: TimeSlot | null;
}

interface FormState {
  disciplineId: string | null;
  coachId: string | null;
  dayOfWeek: string | null;
  startTime: string;
  endTime: string;
  maxCapacity: string;
  room: string;
}

function initialState(slot?: TimeSlot | null): FormState {
  if (slot) {
    return {
      disciplineId: slot.disciplineId,
      coachId: slot.coachId,
      dayOfWeek: String(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxCapacity: String(slot.maxCapacity),
      room: slot.room ?? '',
    };
  }
  return {
    disciplineId: null,
    coachId: null,
    dayOfWeek: null,
    startTime: '',
    endTime: '',
    maxCapacity: '',
    room: '',
  };
}

export function SessionFormModal({ open, onClose, editSlot }: SessionFormModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = editSlot !== null && editSlot !== undefined;

  const [form, setForm] = useState<FormState>(() => initialState(editSlot));
  const [warnings, setWarnings] = useState<TimeSlotWarning[]>([]);
  const [conflictChecked, setConflictChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens / slot changes
  useEffect(() => {
    if (open) {
      setForm(initialState(editSlot));
      setWarnings([]);
      setConflictChecked(false);
      setErrors({});
    }
  }, [open, editSlot]);

  // Fetch disciplines
  const { data: disciplineData } = useQuery({
    queryKey: ['disciplines'],
    queryFn: getDisciplines,
    enabled: open,
  });

  // Fetch coaches (all active coaches)
  const { data: coachData } = useQuery({
    queryKey: ['sessions', 'coaches'],
    queryFn: () => getCoaches(),
    enabled: open,
  });

  const disciplineOptions = useMemo(
    () =>
      (disciplineData?.disciplines ?? [])
        .filter((d) => d.isActive)
        .map((d) => ({ value: d.id, label: d.name })),
    [disciplineData],
  );

  const coachOptions = useMemo(
    () =>
      [
        { value: '', label: 'No coach assigned' },
        ...(coachData?.coaches ?? []).map((c) => ({
          value: c.id,
          label: c.fullNameLatin,
        })),
      ],
    [coachData],
  );

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setConflictChecked(false);
    setWarnings([]);
    // Clear error for this field
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Conflict check mutation
  const conflictMutation = useMutation({
    mutationFn: checkConflicts,
  });

  // Validate form
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.disciplineId) errs.disciplineId = 'Discipline is required';
    if (form.dayOfWeek === null) errs.dayOfWeek = 'Day is required';
    if (!form.startTime) errs.startTime = 'Start time is required';
    if (!form.endTime) errs.endTime = 'End time is required';
    if (form.startTime && form.endTime && form.startTime >= form.endTime) {
      errs.endTime = 'End time must be after start time';
    }
    const cap = Number(form.maxCapacity);
    if (!form.maxCapacity || isNaN(cap) || cap < 1) {
      errs.maxCapacity = 'Must be at least 1';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Handle save
  const handleSave = async () => {
    if (!validate()) return;

    // If not yet conflict-checked, check conflicts first
    if (!conflictChecked) {
      try {
        const result = await conflictMutation.mutateAsync({
          coachId: form.coachId || undefined,
          room: form.room.trim() || undefined,
          dayOfWeek: Number(form.dayOfWeek),
          startTime: form.startTime,
          endTime: form.endTime,
          excludeId: editSlot?.id,
        });

        setConflictChecked(true);

        if (result.hasConflict) {
          setWarnings(result.conflicts);
          // Show warnings but don't block — user can save again
          return;
        }
      } catch {
        toast.show({ type: 'error', title: 'Conflict check failed' });
        return;
      }
    }

    // Proceed with save
    setSubmitting(true);
    try {
      const body = {
        disciplineId: form.disciplineId!,
        coachId: form.coachId || undefined,
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
        maxCapacity: Number(form.maxCapacity),
        room: form.room.trim() || undefined,
      };

      if (isEdit) {
        await updateTimeSlot(editSlot.id, body);
      } else {
        await createTimeSlot(body);
      }

      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.show({
        type: 'success',
        title: isEdit ? 'Session updated' : 'Session created',
        description: `${disciplineOptions.find((d) => d.value === form.disciplineId)?.label ?? 'Session'} on ${DAY_OPTIONS[Number(form.dayOfWeek)]?.label ?? ''}`,
      });
      onClose();
    } catch {
      toast.show({ type: 'error', title: isEdit ? 'Update failed' : 'Creation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Session' : 'Add Session'}
      description="Schedule a recurring time slot for a discipline."
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {/* Discipline */}
        <Select
          label="Discipline"
          options={disciplineOptions}
          value={form.disciplineId}
          onChange={(v) => updateField('disciplineId', v)}
          placeholder="Select discipline..."
          error={errors.disciplineId}
        />

        {/* Coach */}
        <Select
          label="Coach (optional)"
          options={coachOptions}
          value={form.coachId}
          onChange={(v) => updateField('coachId', v || null)}
          placeholder="Select coach..."
        />

        {/* Day of Week */}
        <Select
          label="Day of Week"
          options={DAY_OPTIONS}
          value={form.dayOfWeek}
          onChange={(v) => updateField('dayOfWeek', v)}
          placeholder="Select day..."
          error={errors.dayOfWeek}
        />

        {/* Time row */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Time"
            type="time"
            value={form.startTime}
            onChange={(e) => updateField('startTime', e.target.value)}
            error={errors.startTime}
          />
          <Input
            label="End Time"
            type="time"
            value={form.endTime}
            onChange={(e) => updateField('endTime', e.target.value)}
            error={errors.endTime}
          />
        </div>

        {/* Capacity + Room */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Max Capacity"
            type="number"
            min={1}
            value={form.maxCapacity}
            onChange={(e) => updateField('maxCapacity', e.target.value)}
            error={errors.maxCapacity}
            placeholder="30"
          />
          <Input
            label="Room (optional)"
            value={form.room}
            onChange={(e) => updateField('room', e.target.value)}
            placeholder="e.g. Court A"
          />
        </div>

        {/* Conflict Warnings */}
        {warnings.length > 0 && (
          <div
            className="rounded-md border border-warning/30 bg-warning-bg px-4 py-3"
            role="alert"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-warning-fg">
              <AlertIcon size={16} />
              <span>Schedule Conflicts Detected</span>
            </div>
            <ul className="mt-2 space-y-1 pl-6 text-xs text-warning-fg">
              {warnings.map((w, i) => (
                <li key={i} className="list-disc">
                  {w.message}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-neutral-500">
              Click &quot;Save Anyway&quot; to proceed despite conflicts.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting || conflictMutation.isPending}
            disabled={submitting || conflictMutation.isPending}
          >
            {warnings.length > 0 && conflictChecked
              ? 'Save Anyway'
              : isEdit
                ? 'Update Session'
                : 'Create Session'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
