import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Select, Input } from '../../../../components/ui';
import { useToast } from '../../../../components/ui';
import {
  AlertIcon,
  CheckIcon,
  SpinnerIcon,
  PlusIcon,
} from '../../../../components/ui/Icon';
import { cn } from '../../../../lib/cn';
import {
  getDisciplines,
  getDisciplineTimeSlots,
  getDisciplineInstructors,
  getSubscriptionPlans,
} from '../../api/membersApi';
import type {
  Discipline,
  TimeSlot,
  Instructor,
} from '../../api/membersApi';
import { addEnrollment } from '../editApi';
import type {
  AddEnrollmentPlanType,
  AddEnrollmentPaymentType,
} from '../editApi';
import type { SelectOption } from '../../../../types/ui';

const BELT_RANKS: SelectOption[] = [
  { value: 'White', label: 'White' },
  { value: 'Yellow', label: 'Yellow' },
  { value: 'Green', label: 'Green' },
  { value: 'Blue', label: 'Blue' },
  { value: 'Red', label: 'Red' },
  { value: 'Black', label: 'Black' },
];

const PLAN_TYPE_OPTIONS: SelectOption[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Biannual' },
  { value: 'annual', label: 'Annual' },
  { value: 'session_pack', label: 'Session Pack' },
];

const DAY_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_INDICES = [6, 0, 1, 2, 3, 4, 5];

function formatDZD(centimes: number): string {
  const dzd = centimes / 100;
  return (
    dzd.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' DZD'
  );
}

interface AddDisciplineModalProps {
  open: boolean;
  memberId: string;
  existingDisciplineIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDisciplineModal({
  open,
  memberId,
  existingDisciplineIds,
  onClose,
  onSuccess,
}: AddDisciplineModalProps) {
  const toast = useToast();

  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loadingDisciplines, setLoadingDisciplines] = useState(false);
  const [disciplineError, setDisciplineError] = useState<string | null>(null);

  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);
  const [selectedBelt, setSelectedBelt] = useState<string | null>(null);
  const [selectedTimeSlotIds, setSelectedTimeSlotIds] = useState<Set<string>>(new Set());

  // Billing state
  const [plans, setPlans] = useState<Record<string, Record<string, number>>>({});
  const [planType, setPlanType] = useState<AddEnrollmentPlanType>('monthly');
  const [amountDzd, setAmountDzd] = useState<string>(''); // user-facing (DZD)
  const [paymentOption, setPaymentOption] = useState<AddEnrollmentPaymentType>('full');
  const [paidDzd, setPaidDzd] = useState<string>(''); // partial paid amount (DZD)
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset on open and load disciplines + subscription plans
  useEffect(() => {
    if (!open) return;
    setSelectedDisciplineId(null);
    setTimeSlots([]);
    setInstructors([]);
    setSelectedInstructor(null);
    setSelectedBelt(null);
    setSelectedTimeSlotIds(new Set());
    setSubmitError(null);
    setDetailsError(null);
    setPlanType('monthly');
    setAmountDzd('');
    setPaymentOption('full');
    setPaidDzd('');
    setPaymentNotes('');

    let cancelled = false;
    setLoadingDisciplines(true);
    setDisciplineError(null);
    Promise.all([getDisciplines(), getSubscriptionPlans()])
      .then(([disciplinesRes, plansRes]) => {
        if (cancelled) return;
        setDisciplines(disciplinesRes.disciplines.filter((d) => d.isActive));
        setPlans(plansRes.plans);
      })
      .catch((err) => {
        if (cancelled) return;
        setDisciplineError(
          err instanceof Error ? err.message : 'Failed to load disciplines',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDisciplines(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Load time slots + instructors when discipline selected
  useEffect(() => {
    if (!selectedDisciplineId) return;

    let cancelled = false;
    setLoadingDetails(true);
    setDetailsError(null);
    setTimeSlots([]);
    setInstructors([]);
    setSelectedInstructor(null);
    setSelectedTimeSlotIds(new Set());

    Promise.all([
      getDisciplineTimeSlots(selectedDisciplineId),
      getDisciplineInstructors(selectedDisciplineId),
    ])
      .then(([slotsRes, instructorsRes]) => {
        if (cancelled) return;
        setTimeSlots(slotsRes.timeSlots);
        setInstructors(instructorsRes.instructors);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailsError(
          err instanceof Error ? err.message : 'Failed to load details',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDisciplineId]);

  const availableDisciplines = useMemo(
    () => disciplines.filter((d) => !existingDisciplineIds.includes(d.id)),
    [disciplines, existingDisciplineIds],
  );

  const selectedDiscipline = useMemo(
    () => disciplines.find((d) => d.id === selectedDisciplineId) ?? null,
    [disciplines, selectedDisciplineId],
  );

  const isTaekwondo =
    selectedDiscipline?.name.toLowerCase() === 'taekwondo';

  const instructorOptions: SelectOption[] = instructors.map((i) => ({
    value: i.id,
    label: i.fullNameLatin + (i.fullNameArabic ? ` / ${i.fullNameArabic}` : ''),
  }));

  // Auto-populate amount when discipline or plan type changes
  useEffect(() => {
    if (!selectedDiscipline) return;
    const planPrices = plans[selectedDiscipline.name] ?? {};
    const centimes = planPrices[planType] ?? 0;
    setAmountDzd(centimes > 0 ? String(centimes / 100) : '');
  }, [selectedDiscipline, planType, plans]);

  // Parsed totals in centimes
  const amountCentimes = useMemo(() => {
    const n = parseFloat(amountDzd);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  }, [amountDzd]);

  const paidCentimes = useMemo(() => {
    const n = parseFloat(paidDzd);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  }, [paidDzd]);

  const effectivePaid =
    paymentOption === 'full'
      ? amountCentimes
      : paymentOption === 'later'
        ? 0
        : paidCentimes;
  const remainingCentimes = Math.max(0, amountCentimes - effectivePaid);

  const toggleTimeSlot = (slotId: string) => {
    setSelectedTimeSlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedDisciplineId) return;
    if (selectedTimeSlotIds.size === 0) {
      setSubmitError('Select at least one schedule');
      return;
    }
    if (isTaekwondo && !selectedBelt) {
      setSubmitError('Select a belt rank');
      return;
    }
    if (amountCentimes <= 0) {
      setSubmitError('Amount must be greater than 0');
      return;
    }
    if (paymentOption === 'partial') {
      if (paidCentimes <= 0) {
        setSubmitError('Partial payment amount must be greater than 0');
        return;
      }
      if (paidCentimes > amountCentimes) {
        setSubmitError('Partial payment cannot exceed total amount');
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const schedules = timeSlots
        .filter((s) => selectedTimeSlotIds.has(s.id))
        .map((s) => ({ dayOfWeek: s.dayOfWeek, timeSlotId: s.id }));

      const res = await addEnrollment(memberId, {
        disciplineId: selectedDisciplineId,
        instructorId: selectedInstructor,
        beltRank: isTaekwondo ? selectedBelt : null,
        schedules,
        billing: {
          planType,
          amount: amountCentimes,
          payment: {
            paymentType: paymentOption,
            paidAmount:
              paymentOption === 'partial'
                ? paidCentimes
                : paymentOption === 'full'
                  ? amountCentimes
                  : 0,
            notes: paymentNotes.trim() || undefined,
          },
        },
      });

      const discName = selectedDiscipline?.name ?? 'Discipline';
      const description = res.payment
        ? `${discName} added. Receipt ${res.payment.receiptNumber}.`
        : `${discName} added successfully.`;
      toast.show({
        type: 'success',
        title: 'Enrollment added',
        description,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to add enrollment';
      setSubmitError(message);
      toast.show({
        type: 'error',
        title: 'Enrollment failed',
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    selectedDisciplineId !== null &&
    selectedTimeSlotIds.size > 0 &&
    (!isTaekwondo || selectedBelt !== null) &&
    amountCentimes > 0 &&
    (paymentOption !== 'partial' ||
      (paidCentimes > 0 && paidCentimes <= amountCentimes));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Discipline"
      description="Enroll this member in a new discipline"
      size="lg"
    >
      <div className="flex flex-col gap-5">
        {loadingDisciplines && (
          <div className="flex items-center justify-center gap-2 py-6 text-neutral-500">
            <SpinnerIcon size={16} />
            <span className="text-sm">Loading disciplines…</span>
          </div>
        )}

        {disciplineError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
          >
            <AlertIcon size={14} className="shrink-0 mt-0.5" />
            <span>{disciplineError}</span>
          </div>
        )}

        {!loadingDisciplines && !disciplineError && availableDisciplines.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
            <p className="text-sm font-medium text-neutral-700">
              All disciplines already enrolled
            </p>
            <p className="text-xs text-neutral-500">
              This member is already enrolled in every available discipline.
            </p>
          </div>
        )}

        {!loadingDisciplines && availableDisciplines.length > 0 && (
          <>
            {/* Discipline picker */}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-neutral-700">
                Discipline
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableDisciplines.map((disc) => {
                  const selected = selectedDisciplineId === disc.id;
                  return (
                    <button
                      key={disc.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedDisciplineId(disc.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                        selected
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                          selected
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-neutral-300',
                        )}
                      >
                        {selected && <CheckIcon size={10} className="text-white" />}
                      </span>
                      <span className="truncate">{disc.name}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Details for selected discipline */}
            {selectedDisciplineId && (
              <>
                {loadingDetails && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <SpinnerIcon size={14} />
                    Loading time slots and instructors…
                  </div>
                )}

                {detailsError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
                  >
                    <AlertIcon size={14} className="shrink-0 mt-0.5" />
                    <span>{detailsError}</span>
                  </div>
                )}

                {!loadingDetails && !detailsError && (
                  <>
                    {/* Instructor + Belt */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select
                        label="Instructor"
                        placeholder="Select instructor (optional)"
                        options={instructorOptions}
                        value={selectedInstructor}
                        onChange={(v) => setSelectedInstructor(v)}
                      />
                      {isTaekwondo && (
                        <Select
                          label="Belt rank"
                          placeholder="Select belt rank"
                          options={BELT_RANKS}
                          value={selectedBelt}
                          onChange={(v) => setSelectedBelt(v)}
                        />
                      )}
                    </div>

                    {/* Schedule picker */}
                    <div>
                      <p className="mb-2 text-sm font-semibold text-neutral-700">
                        Weekly schedule
                      </p>
                      {timeSlots.length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          No available time slots for this discipline.
                        </p>
                      ) : (
                        <ScheduleGrid
                          timeSlots={timeSlots}
                          selectedIds={selectedTimeSlotIds}
                          onToggle={toggleTimeSlot}
                        />
                      )}
                    </div>

                    {/* Billing & Payment */}
                    <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-neutral-700">
                          Billing & Payment
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          Subscription for the new discipline. No registration or
                          license fees are charged again.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                          label="Plan type"
                          placeholder="Select plan"
                          options={PLAN_TYPE_OPTIONS}
                          value={planType}
                          onChange={(v) =>
                            setPlanType(v as AddEnrollmentPlanType)
                          }
                        />
                        <Input
                          label="Amount (DZD)"
                          type="number"
                          min={0}
                          step="1"
                          value={amountDzd}
                          onChange={(e) => setAmountDzd(e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>

                      <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Payment option
                        </legend>
                        {(['full', 'partial', 'later'] as const).map(
                          (option) => (
                            <label
                              key={option}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                                paymentOption === option
                                  ? 'border-primary-500 bg-primary-50'
                                  : 'border-neutral-200 bg-white hover:border-neutral-300',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                                  paymentOption === option
                                    ? 'border-primary-500'
                                    : 'border-neutral-300',
                                )}
                              >
                                {paymentOption === option && (
                                  <span className="h-2 w-2 rounded-full bg-primary-500" />
                                )}
                              </span>
                              <input
                                type="radio"
                                name="addDisciplinePayment"
                                value={option}
                                checked={paymentOption === option}
                                onChange={() => setPaymentOption(option)}
                                className="sr-only"
                              />
                              <span className="text-sm font-medium text-neutral-800">
                                {option === 'full'
                                  ? 'Pay Full'
                                  : option === 'partial'
                                    ? 'Pay Partial'
                                    : 'Pay Later'}
                              </span>
                            </label>
                          ),
                        )}
                      </fieldset>

                      {paymentOption === 'partial' && (
                        <Input
                          label="Paid amount (DZD)"
                          type="number"
                          min={0}
                          step="1"
                          value={paidDzd}
                          onChange={(e) => setPaidDzd(e.target.value)}
                          placeholder="Amount paid now"
                        />
                      )}

                      <div>
                        <label
                          htmlFor="add-discipline-payment-notes"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                        >
                          Notes (optional)
                        </label>
                        <textarea
                          id="add-discipline-payment-notes"
                          rows={2}
                          maxLength={500}
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus-visible:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                          placeholder="Internal note for this payment"
                        />
                      </div>

                      {/* Summary */}
                      <div className="flex flex-col gap-1 rounded-md bg-white/70 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Total</span>
                          <span className="font-semibold text-neutral-900">
                            {formatDZD(amountCentimes)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600">Paid now</span>
                          <span className="font-medium text-success">
                            {formatDZD(effectivePaid)}
                          </span>
                        </div>
                        {remainingCentimes > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-600">Remaining</span>
                            <span className="font-medium text-warning">
                              {formatDZD(remainingCentimes)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
          >
            <AlertIcon size={14} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <Button
            variant="primary"
            iconLeft={submitting ? <SpinnerIcon size={16} /> : <PlusIcon size={16} />}
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            loading={submitting}
          >
            Add Discipline
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────── Schedule Grid ──────── */

interface ScheduleGridProps {
  timeSlots: TimeSlot[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

function ScheduleGrid({ timeSlots, selectedIds, onToggle }: ScheduleGridProps) {
  const uniqueTimes = useMemo(() => {
    const set = new Map<string, { startTime: string; endTime: string }>();
    for (const slot of timeSlots) {
      const key = `${slot.startTime}-${slot.endTime}`;
      if (!set.has(key)) {
        set.set(key, { startTime: slot.startTime, endTime: slot.endTime });
      }
    }
    return Array.from(set.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }, [timeSlots]);

  const slotMap = useMemo(() => {
    const map = new Map<string, TimeSlot>();
    for (const slot of timeSlots) {
      const key = `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
      map.set(key, slot);
    }
    return map;
  }, [timeSlots]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-24 border-b border-neutral-200 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Time
            </th>
            {DAY_INDICES.map((dayIdx, i) => (
              <th
                key={dayIdx}
                className="border-b border-neutral-200 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                {DAY_NAMES[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueTimes.map((time) => (
            <tr key={`${time.startTime}-${time.endTime}`}>
              <td className="border-b border-neutral-100 py-2 pr-2 text-xs text-neutral-600">
                {time.startTime} – {time.endTime}
              </td>
              {DAY_INDICES.map((dayIdx) => {
                const key = `${dayIdx}-${time.startTime}-${time.endTime}`;
                const slot = slotMap.get(key);
                if (!slot) {
                  return (
                    <td
                      key={dayIdx}
                      className="border-b border-neutral-100 p-1 text-center"
                    >
                      <div className="mx-auto h-7 w-full rounded bg-neutral-50" />
                    </td>
                  );
                }
                const isSelected = selectedIds.has(slot.id);
                return (
                  <td
                    key={dayIdx}
                    className="border-b border-neutral-100 p-1 text-center"
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onToggle(slot.id)}
                      className={cn(
                        'mx-auto flex h-7 w-full items-center justify-center rounded text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
                        isSelected
                          ? 'bg-primary-500 text-white shadow-elevation-1'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-primary-100 hover:text-primary-700',
                      )}
                    >
                      {isSelected ? 'Selected' : 'Open'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
