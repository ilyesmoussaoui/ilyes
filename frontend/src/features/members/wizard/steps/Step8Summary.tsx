import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '../../../../lib/cn';
import { Button, Modal, Skeleton, useToast } from '../../../../components/ui';
import { AlertIcon, CheckIcon, ChevronRightIcon, UserIcon } from '../../../../components/ui/Icon';
import { useWizard } from '../useWizard';
import { finalizeMember } from '../../api/membersApi';
import { clearWizardState } from '../../helpers/storage';
import { EMPTY_WIZARD_STATE, STEP_LABELS, type StepKey } from '../wizardTypes';
import { fetchFeeSettings } from '../../../settings/settingsApi';

const FEE_DEFAULTS = { registrationFee: 50000, licenseFee: 120000, extraSessionPrice: 75000 };

function formatDZD(centimes: number): string {
  const dzd = centimes / 100;
  return dzd.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' DZD';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Step8Summary() {
  const {
    state,
    update,
    visibleSteps,
    goToStep,
    registerValidator,
    registerAdvanceHandler,
    notifyStepEvaluation,
  } = useWizard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [showSuccess, setShowSuccess] = useState(false);

  // Fee settings from backend (same query key as Step7 — shared cache)
  const {
    data: feeData,
    isLoading: feeLoading,
    isError: feeError,
  } = useQuery({
    queryKey: ['settings', 'fees'],
    queryFn: fetchFeeSettings,
    staleTime: 5 * 60 * 1000,
  });

  const registrationFee = feeData?.registrationFee ?? FEE_DEFAULTS.registrationFee;
  const licenseFee = feeData?.licenseFee ?? FEE_DEFAULTS.licenseFee;

  // Summary is always valid
  useEffect(() => {
    notifyStepEvaluation('review', true);
  }, [notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('review', () => ({ ok: true, errors: {} }));
  }, [registerValidator]);

  useEffect(() => {
    return registerAdvanceHandler('review', async () => {
      if (!state.memberId) {
        show({
          type: 'error',
          title: 'Session incomplete',
          description: 'Member ID is missing — please restart the wizard.',
        });
        // Navigate back to step 1 if possible
        const classificationIdx = visibleSteps.indexOf('classification');
        if (classificationIdx >= 0) {
          goToStep(classificationIdx + 1);
        }
        return false;
      }
      try {
        const res = await finalizeMember(state.memberId);
        update({
          finalMemberId: res.member.id,
          receiptNumber: state.receiptNumber,
        });
        await queryClient.invalidateQueries({ queryKey: ['members'] });
        setShowSuccess(true);
        return true;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to finalize member. Please try again.';
        show({ type: 'error', title: 'Could not confirm registration', description: message });
        return false;
      }
    });
  }, [
    state.memberId,
    state.receiptNumber,
    update,
    registerAdvanceHandler,
    visibleSteps,
    goToStep,
    show,
    queryClient,
  ]);

  const navigateToStep = (stepKey: StepKey) => {
    const idx = visibleSteps.indexOf(stepKey);
    if (idx >= 0) {
      goToStep(idx + 1);
    }
  };

  const handleAddAnother = () => {
    clearWizardState();
    update({ ...EMPTY_WIZARD_STATE });
    setShowSuccess(false);
  };

  const handleViewMember = () => {
    const id = state.finalMemberId ?? state.memberId;
    navigate(`/members/${id}`);
  };

  const handleGoToList = () => {
    clearWizardState();
    navigate('/members');
  };

  // Compute totals for billing display
  const subscriptionTotal = state.subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const equipmentTotal = state.equipmentSelections.reduce(
    (sum, e) => sum + e.price * e.quantity,
    0,
  );
  const grandTotal = registrationFee + licenseFee + subscriptionTotal + equipmentTotal;
  const effectivePaid =
    state.paymentOption === 'full'
      ? grandTotal
      : state.paymentOption === 'later'
        ? 0
        : state.paidAmount;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Review & Confirm</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Review all information before confirming. Click any section header to go back and edit.
        </p>
      </header>

      {/* 1. Classification */}
      <SummarySection
        stepKey="classification"
        label={STEP_LABELS.classification}
        onNavigate={navigateToStep}
        visibleSteps={visibleSteps}
      >
        <SummaryRow label="Type" value={state.type ?? ''} warn={!state.type} />
        {state.type === 'staff' && (
          <SummaryRow label="Staff Role" value={state.staffRole ?? ''} warn={!state.staffRole} />
        )}
      </SummarySection>

      {/* 2. Photo */}
      <SummarySection
        stepKey="photo"
        label={STEP_LABELS.photo}
        onNavigate={navigateToStep}
        visibleSteps={visibleSteps}
      >
        {state.photo.blobUrl || state.photo.serverUrl ? (
          <img
            src={state.photo.blobUrl ?? state.photo.serverUrl ?? undefined}
            alt="Member photo"
            className="h-20 w-20 rounded-lg border border-neutral-200 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50">
            <UserIcon size={24} className="text-neutral-400" />
          </div>
        )}
        {!state.photo.blobUrl && !state.photo.serverUrl && (
          <p className="flex items-center gap-1 text-xs text-warning">
            <AlertIcon size={12} /> No photo captured
          </p>
        )}
      </SummarySection>

      {/* 3. Identity */}
      <SummarySection
        stepKey="identity"
        label={STEP_LABELS.identity}
        onNavigate={navigateToStep}
        visibleSteps={visibleSteps}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
          <SummaryRow
            label="Name (Latin)"
            value={`${state.firstNameLatin} ${state.lastNameLatin}`.trim()}
            warn={!state.firstNameLatin || !state.lastNameLatin}
          />
          <SummaryRow
            label="Name (Arabic)"
            value={`${state.firstNameArabic} ${state.lastNameArabic}`.trim() || 'N/A'}
          />
          <SummaryRow label="Gender" value={state.gender ?? ''} warn={!state.gender} />
          <SummaryRow
            label="Date of Birth"
            value={state.dateOfBirth ?? ''}
            warn={!state.dateOfBirth}
          />
          <SummaryRow label="Wilaya" value={state.wilayaCode ?? ''} warn={!state.wilayaCode} />
        </div>
      </SummarySection>

      {/* 4. Contact */}
      <SummarySection
        stepKey="contact"
        label={STEP_LABELS.contact}
        onNavigate={navigateToStep}
        visibleSteps={visibleSteps}
      >
        <div className="flex flex-col gap-1">
          {state.phones.filter((p) => p.value).map((p) => (
            <SummaryRow key={p.id} label="Phone" value={p.value} />
          ))}
          {state.phones.filter((p) => p.value).length === 0 && (
            <SummaryRow label="Phone" value="" warn />
          )}
          {state.emails.filter((e) => e.value).map((e) => (
            <SummaryRow key={e.id} label="Email" value={e.value} />
          ))}
          {state.address && <SummaryRow label="Address" value={state.address} />}
          {state.emergencyContacts.length > 0 && (
            <div className="mt-1">
              <span className="text-xs font-semibold uppercase text-neutral-500">
                Emergency Contacts
              </span>
              {state.emergencyContacts.map((ec) => (
                <SummaryRow
                  key={ec.id}
                  label={ec.relationship}
                  value={`${ec.name} (${ec.phone})`}
                />
              ))}
            </div>
          )}
        </div>
      </SummarySection>

      {/* 5. Disciplines */}
      {visibleSteps.includes('disciplines') && (
        <SummarySection
          stepKey="disciplines"
          label={STEP_LABELS.disciplines}
          onNavigate={navigateToStep}
          visibleSteps={visibleSteps}
        >
          {state.disciplines.length === 0 ? (
            <p className="flex items-center gap-1 text-xs text-warning">
              <AlertIcon size={12} /> No disciplines selected
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {state.disciplines.map((d) => (
                <div key={d.id} className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-neutral-900">
                    {d.disciplineName}
                  </span>
                  {d.beltRank && (
                    <span className="text-xs text-neutral-500">Belt: {d.beltRank}</span>
                  )}
                  {d.schedules.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.schedules.map((s) => (
                        <span
                          key={s.timeSlotId}
                          className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                        >
                          {DAY_NAMES[s.dayOfWeek]} {s.startTime}-{s.endTime}
                        </span>
                      ))}
                    </div>
                  )}
                  {d.schedules.length === 0 && (
                    <span className="flex items-center gap-1 text-xs text-warning">
                      <AlertIcon size={12} /> No schedule
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SummarySection>
      )}

      {/* 6. Documents */}
      <SummarySection
        stepKey="documents"
        label={STEP_LABELS.documents}
        onNavigate={navigateToStep}
        visibleSteps={visibleSteps}
      >
        {state.documents.filter((d) => d.checked).length === 0 ? (
          <p className="text-xs text-neutral-500">No documents checked</p>
        ) : (
          <div className="flex flex-col gap-1">
            {state.documents
              .filter((d) => d.checked)
              .map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm">
                  {d.filePath ? (
                    <CheckIcon size={14} className="text-success" />
                  ) : (
                    <AlertIcon size={14} className="text-warning" />
                  )}
                  <span className="text-neutral-700">{d.label}</span>
                  {d.filePath ? (
                    <span className="text-xs text-success">Uploaded</span>
                  ) : (
                    <span className="text-xs text-warning">Missing file</span>
                  )}
                </div>
              ))}
          </div>
        )}
      </SummarySection>

      {/* 7. Billing */}
      {visibleSteps.includes('billing') && (
        <SummarySection
          stepKey="billing"
          label={STEP_LABELS.billing}
          onNavigate={navigateToStep}
          visibleSteps={visibleSteps}
        >
          <div className="flex flex-col gap-2 text-sm">
            {feeError && (
              <p className="rounded-md bg-warning-bg px-3 py-1.5 text-xs text-warning-fg">
                Could not load fees from server — using defaults.
              </p>
            )}
            {feeLoading ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <Skeleton variant="block" width="120px" height="14px" />
                  <Skeleton variant="block" width="72px" height="14px" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Skeleton variant="block" width="96px" height="14px" />
                  <Skeleton variant="block" width="72px" height="14px" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Registration Fee</span>
                  <span className="font-medium">{formatDZD(registrationFee)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">License Fee</span>
                  <span className="font-medium">{formatDZD(licenseFee)}</span>
                </div>
              </>
            )}
            {state.subscriptions
              .filter((s) => s.amount > 0)
              .map((s) => (
                <div key={s.disciplineId} className="flex items-center justify-between">
                  <span className="text-neutral-600">
                    {s.disciplineName} ({s.planType})
                  </span>
                  <span className="font-medium">{formatDZD(s.amount)}</span>
                </div>
              ))}
            {state.equipmentSelections.map((e) => (
              <div key={e.equipmentId} className="flex items-center justify-between">
                <span className="text-neutral-600">
                  {e.name} x{e.quantity}
                </span>
                <span className="font-medium">{formatDZD(e.price * e.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-neutral-200 pt-2">
              <div className="flex items-center justify-between font-semibold text-neutral-900">
                <span>Total</span>
                <span>{formatDZD(grandTotal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Payment</span>
              <span className="capitalize">{state.paymentOption}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Paid</span>
              <span className="text-success">{formatDZD(effectivePaid)}</span>
            </div>
            {grandTotal - effectivePaid > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Remaining</span>
                <span className="text-warning">{formatDZD(grandTotal - effectivePaid)}</span>
              </div>
            )}
          </div>
        </SummarySection>
      )}

      {/* Success Modal */}
      <Modal
        open={showSuccess}
        onClose={() => {}}
        closeOnOverlay={false}
        size="md"
      >
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
            <CheckIcon size={32} className="text-success" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              Member Created Successfully
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              The member has been registered in the system.
            </p>
          </div>
          {state.finalMemberId && (
            <div className="flex flex-col gap-1 rounded-md bg-neutral-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-500">Member ID</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {state.finalMemberId}
                </span>
              </div>
              {state.receiptNumber && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-neutral-500">Receipt</span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {state.receiptNumber}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button variant="secondary" onClick={handleAddAnother}>
              Add Another Member
            </Button>
            <Button variant="secondary" onClick={handleViewMember}>
              View Member
            </Button>
            <Button variant="primary" onClick={handleGoToList}>
              Go to Members List
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ──────── Summary Section ──────── */

interface SummarySectionProps {
  stepKey: StepKey;
  label: string;
  onNavigate: (key: StepKey) => void;
  visibleSteps: StepKey[];
  children: React.ReactNode;
}

function SummarySection({
  stepKey,
  label,
  onNavigate,
  visibleSteps,
  children,
}: SummarySectionProps) {
  const isClickable = visibleSteps.includes(stepKey);
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        disabled={!isClickable}
        onClick={() => onNavigate(stepKey)}
        className={cn(
          'flex w-full items-center justify-between border-b border-neutral-100 px-5 py-3 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
          isClickable
            ? 'cursor-pointer hover:bg-neutral-50'
            : 'cursor-default',
        )}
      >
        <h3 className="text-sm font-semibold text-neutral-900">{label}</h3>
        {isClickable && <ChevronRightIcon size={14} className="text-neutral-400" />}
      </button>
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

/* ──────── Summary Row ──────── */

function SummaryRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  const empty = !value.trim();
  return (
    <div className="flex items-center gap-2 py-0.5 text-sm">
      <span className="w-32 shrink-0 text-neutral-500">{label}:</span>
      {empty || warn ? (
        <span className="flex items-center gap-1 text-warning">
          <AlertIcon size={12} />
          {empty ? 'Not set' : value}
        </span>
      ) : (
        <span className="text-neutral-900">{value}</span>
      )}
    </div>
  );
}
