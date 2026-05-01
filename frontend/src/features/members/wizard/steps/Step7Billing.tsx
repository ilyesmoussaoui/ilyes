import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../../../lib/cn';
import { Input, Select, Skeleton } from '../../../../components/ui';
import {
  TrashIcon,
  SearchIcon,
  UserIcon,
} from '../../../../components/ui/Icon';
import { useWizard } from '../useWizard';
import type {
  SubscriptionEntry,
  FamilyLinkEntry,
} from '../wizardTypes';
import type { SelectOption } from '../../../../types/ui';
import {
  getSubscriptionPlans,
  getEquipment,
  searchMembers,
  createMemberBilling,
  type EquipmentItem,
  type SearchMemberResult,
} from '../../api/membersApi';
import { fetchFeeSettings } from '../../../settings/settingsApi';

const FEE_DEFAULTS = { registrationFee: 50000, licenseFee: 120000, extraSessionPrice: 75000 };

const PLAN_TYPE_OPTIONS: SelectOption[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Biannual' },
  { value: 'annual', label: 'Annual' },
  { value: 'session_pack', label: 'Session Pack' },
];

const RELATIONSHIP_OPTIONS: SelectOption[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'other', label: 'Other' },
];

function formatDZD(centimes: number): string {
  const dzd = centimes / 100;
  return dzd.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' DZD';
}

export function Step7Billing() {
  const { state, update, registerValidator, registerAdvanceHandler, notifyStepEvaluation } =
    useWizard();
  const baseId = useId();

  // Fee settings from backend (React Query — stale for 5 minutes)
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
  // TODO: wire extraSessionPrice into per-session UI when that feature is added
  // const extraSessionPrice = feeData?.extraSessionPrice ?? FEE_DEFAULTS.extraSessionPrice;

  // Fetched data
  const [plans, setPlans] = useState<Record<string, Record<string, number>>>({});
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<number | null>(null);

  // Fetch subscription plans and equipment on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getSubscriptionPlans(), getEquipment()])
      .then(([plansRes, equipRes]) => {
        if (cancelled) return;
        setPlans(plansRes.plans);
        setEquipmentList(equipRes.equipment);
        setFetchError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to load billing data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize subscriptions from enrolled disciplines
  useEffect(() => {
    const existing = new Set(state.subscriptions.map((s) => s.disciplineId));
    const enrolled = state.disciplines.map((d) => d.disciplineId);
    const needsInit = enrolled.some((id) => !existing.has(id));
    if (needsInit) {
      const subs: SubscriptionEntry[] = state.disciplines.map((d) => {
        const existingSub = state.subscriptions.find(
          (s) => s.disciplineId === d.disciplineId,
        );
        return existingSub ?? {
          disciplineId: d.disciplineId,
          disciplineName: d.disciplineName,
          planType: '',
          amount: 0,
        };
      });
      update({ subscriptions: subs });
    }
  }, [state.disciplines, state.subscriptions, update]);

  // Search members
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(() => {
      searchMembers(searchQuery.trim())
        .then((res) => {
          setSearchResults(
            res.members.filter((m) => m.id !== state.memberId),
          );
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, state.memberId]);

  // Update subscription
  const updateSubscription = useCallback(
    (disciplineId: string, planType: string) => {
      update({
        subscriptions: state.subscriptions.map((s) => {
          if (s.disciplineId !== disciplineId) return s;
          const planPrices = plans[s.disciplineName] ?? {};
          const amount = planPrices[planType] ?? 0;
          return { ...s, planType, amount };
        }),
      });
    },
    [state.subscriptions, plans, update],
  );

  // Equipment
  const updateEquipment = useCallback(
    (equipmentId: string, quantity: number) => {
      const item = equipmentList.find((e) => e.id === equipmentId);
      if (!item) return;
      if (quantity <= 0) {
        update({
          equipmentSelections: state.equipmentSelections.filter(
            (e) => e.equipmentId !== equipmentId,
          ),
        });
      } else {
        const exists = state.equipmentSelections.find(
          (e) => e.equipmentId === equipmentId,
        );
        if (exists) {
          update({
            equipmentSelections: state.equipmentSelections.map((e) =>
              e.equipmentId === equipmentId
                ? { ...e, quantity: Math.min(quantity, 6) }
                : e,
            ),
          });
        } else {
          update({
            equipmentSelections: [
              ...state.equipmentSelections,
              {
                equipmentId,
                name: item.name,
                price: item.price,
                quantity: Math.min(quantity, 6),
              },
            ],
          });
        }
      }
    },
    [equipmentList, state.equipmentSelections, update],
  );

  // Family links
  const addFamilyLink = useCallback(
    (member: SearchMemberResult) => {
      const alreadyLinked = state.familyLinks.some(
        (l) => l.relatedMemberId === member.id,
      );
      if (alreadyLinked) return;
      const link: FamilyLinkEntry = {
        relatedMemberId: member.id,
        relatedMemberName: `${member.firstNameLatin} ${member.lastNameLatin}`,
        relationship: '',
      };
      update({ familyLinks: [...state.familyLinks, link] });
      setSearchQuery('');
      setSearchResults([]);
    },
    [state.familyLinks, update],
  );

  const updateFamilyLink = useCallback(
    (memberId: string, relationship: string) => {
      update({
        familyLinks: state.familyLinks.map((l) =>
          l.relatedMemberId === memberId ? { ...l, relationship } : l,
        ),
      });
    },
    [state.familyLinks, update],
  );

  const removeFamilyLink = useCallback(
    (memberId: string) => {
      update({
        familyLinks: state.familyLinks.filter(
          (l) => l.relatedMemberId !== memberId,
        ),
      });
    },
    [state.familyLinks, update],
  );

  // Computed totals
  const subscriptionTotal = useMemo(
    () => state.subscriptions.reduce((sum, s) => sum + s.amount, 0),
    [state.subscriptions],
  );

  const equipmentTotal = useMemo(
    () =>
      state.equipmentSelections.reduce(
        (sum, e) => sum + e.price * e.quantity,
        0,
      ),
    [state.equipmentSelections],
  );

  const grandTotal = registrationFee + licenseFee + subscriptionTotal + equipmentTotal;

  // Update paidAmount when payment option changes
  useEffect(() => {
    if (state.paymentOption === 'full') {
      update({ paidAmount: grandTotal });
    } else if (state.paymentOption === 'later') {
      update({ paidAmount: 0 });
    }
  }, [state.paymentOption, grandTotal, update]);

  // Filter equipment to show only relevant items
  const relevantEquipment = useMemo(() => {
    const disciplineIds = new Set(state.disciplines.map((d) => d.disciplineId));
    return equipmentList.filter(
      (e) => !e.disciplineId || disciplineIds.has(e.disciplineId),
    );
  }, [equipmentList, state.disciplines]);

  // Validation
  const validationResult = useMemo(() => {
    const errors: Record<string, string> = {};
    state.subscriptions.forEach((s) => {
      if (!s.planType) {
        errors[`plan-${s.disciplineId}`] = `Select a plan for ${s.disciplineName}`;
      }
    });
    if (state.paymentOption === 'partial') {
      if (state.paidAmount <= 0) {
        errors.paidAmount = 'Partial payment amount must be greater than 0';
      } else if (state.paidAmount >= grandTotal) {
        errors.paidAmount = 'Partial amount must be less than total';
      }
    }
    const ok = Object.keys(errors).length === 0;
    return {
      ok,
      errors,
      firstInvalidFieldId: ok ? undefined : `${baseId}-plan-0`,
    };
  }, [state.subscriptions, state.paymentOption, state.paidAmount, grandTotal, baseId]);

  useEffect(() => {
    notifyStepEvaluation('billing', validationResult.ok);
  }, [validationResult.ok, notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('billing', () => validationResult);
  }, [validationResult, registerValidator]);

  useEffect(() => {
    return registerAdvanceHandler('billing', async () => {
      if (!state.memberId) return false;
      const effectivePaidAmount =
        state.paymentOption === 'full'
          ? grandTotal
          : state.paymentOption === 'later'
            ? 0
            : state.paidAmount;
      const res = await createMemberBilling(state.memberId, {
        subscriptions: state.subscriptions
          .filter((s) => s.planType)
          .map((s) => ({
            disciplineId: s.disciplineId,
            planType: s.planType,
            amount: s.amount,
          })),
        equipment: state.equipmentSelections.map((e) => ({
          equipmentId: e.equipmentId,
          quantity: e.quantity,
        })),
        familyLinks: state.familyLinks
          .filter((l) => l.relationship)
          .map((l) => ({
            relatedMemberId: l.relatedMemberId,
            relationship: l.relationship,
          })),
        payment: {
          paymentType: state.paymentOption,
          paidAmount: effectivePaidAmount,
        },
      });
      if (res.payment) {
        update({ receiptNumber: res.payment.receiptNumber });
      }
      return true;
    });
  }, [
    state.memberId,
    state.subscriptions,
    state.equipmentSelections,
    state.familyLinks,
    state.paymentOption,
    state.paidAmount,
    grandTotal,
    update,
    registerAdvanceHandler,
  ]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold text-neutral-900">Billing & Payment</h2>
          <p className="mt-1 text-sm text-neutral-500">Loading billing data...</p>
        </header>
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold text-neutral-900">Billing & Payment</h2>
        </header>
        <div className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm text-danger-fg">
          <p>{fetchError}</p>
        </div>
      </div>
    );
  }

  const effectivePaid =
    state.paymentOption === 'full'
      ? grandTotal
      : state.paymentOption === 'later'
        ? 0
        : state.paidAmount;
  const remaining = Math.max(0, grandTotal - effectivePaid);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Billing & Payment</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Configure subscription plans, equipment, and payment details.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Left side: sections */}
        <div className="flex flex-col gap-8 lg:col-span-3">
          {/* Section A: Subscription Plans */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Subscription Plans
            </h3>
            {state.subscriptions.map((sub, idx) => (
              <div
                key={sub.disciplineId}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-900">
                    {sub.disciplineName}
                  </span>
                  {sub.amount > 0 && (
                    <span className="text-sm font-semibold text-primary-600">
                      {formatDZD(sub.amount)}
                    </span>
                  )}
                </div>
                <Select
                  id={`${baseId}-plan-${idx}`}
                  label="Plan type"
                  placeholder="Select plan"
                  options={PLAN_TYPE_OPTIONS}
                  value={sub.planType || null}
                  onChange={(v) => updateSubscription(sub.disciplineId, v)}
                  error={validationResult.errors[`plan-${sub.disciplineId}`] ?? null}
                />
              </div>
            ))}
            {state.subscriptions.length === 0 && (
              <p className="text-sm text-neutral-500">No disciplines enrolled.</p>
            )}
          </section>

          {/* Section B: Equipment */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Equipment
            </h3>
            {relevantEquipment.length === 0 ? (
              <p className="text-sm text-neutral-500">No equipment available.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {relevantEquipment.map((item) => {
                  const sel = state.equipmentSelections.find(
                    (e) => e.equipmentId === item.id,
                  );
                  const qty = sel?.quantity ?? 0;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-3 transition-colors',
                        qty > 0
                          ? 'border-primary-200 bg-primary-50'
                          : 'border-neutral-200 bg-white',
                      )}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">{item.name}</p>
                        <p className="text-xs text-neutral-500">{formatDZD(item.price)} / unit</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateEquipment(item.id, qty - 1)}
                          disabled={qty === 0}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                            qty === 0
                              ? 'cursor-not-allowed border-neutral-200 text-neutral-300'
                              : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100',
                          )}
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-neutral-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateEquipment(item.id, qty + 1)}
                          disabled={qty >= 6}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                            qty >= 6
                              ? 'cursor-not-allowed border-neutral-200 text-neutral-300'
                              : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100',
                          )}
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section C: Family Links */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Family Links
            </h3>

            {/* Search */}
            <div className="relative max-w-sm">
              <Input
                placeholder="Search members to link..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                iconLeft={<SearchIcon size={16} />}
              />
              {(searching || searchResults.length > 0) && searchQuery.trim().length >= 2 && (
                <div className="absolute top-full z-20 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-elevation-2">
                  {searching && (
                    <div className="px-3 py-2 text-sm text-neutral-500">Searching...</div>
                  )}
                  {!searching && searchResults.length === 0 && (
                    <div className="px-3 py-2 text-sm text-neutral-500">No members found</div>
                  )}
                  {searchResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addFamilyLink(m)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-none"
                    >
                      {m.photoUrl ? (
                        <img
                          src={m.photoUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                          <UserIcon size={14} />
                        </div>
                      )}
                      <span className="text-neutral-900">
                        {m.firstNameLatin} {m.lastNameLatin}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Linked members */}
            {state.familyLinks.length === 0 && (
              <p className="text-xs text-neutral-500">No family links added.</p>
            )}
            <div className="flex flex-col gap-3">
              {state.familyLinks.map((link) => (
                <div
                  key={link.relatedMemberId}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                    <UserIcon size={14} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-neutral-900">
                    {link.relatedMemberName}
                  </span>
                  <div className="w-36">
                    <Select
                      placeholder="Relation"
                      options={RELATIONSHIP_OPTIONS}
                      value={link.relationship || null}
                      onChange={(v) =>
                        updateFamilyLink(link.relatedMemberId, v)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFamilyLink(link.relatedMemberId)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    aria-label={`Remove link to ${link.relatedMemberName}`}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Section D: Payment */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Payment
            </h3>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Payment option</legend>
              {(['full', 'partial', 'later'] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                    state.paymentOption === option
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      state.paymentOption === option
                        ? 'border-primary-600'
                        : 'border-neutral-300',
                    )}
                  >
                    {state.paymentOption === option && (
                      <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />
                    )}
                  </span>
                  <input
                    type="radio"
                    name="paymentOption"
                    value={option}
                    checked={state.paymentOption === option}
                    onChange={() => update({ paymentOption: option })}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-neutral-900">
                    {option === 'full'
                      ? 'Full Payment'
                      : option === 'partial'
                        ? 'Partial Payment'
                        : 'Pay Later'}
                  </span>
                </label>
              ))}
            </fieldset>

            {state.paymentOption === 'partial' && (
              <div className="max-w-xs">
                <Input
                  label="Amount to pay now (DZD)"
                  type="number"
                  value={state.paidAmount > 0 ? String(state.paidAmount / 100) : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    update({
                      paidAmount: Number.isNaN(val) ? 0 : Math.round(val * 100),
                    });
                  }}
                  error={validationResult.errors.paidAmount ?? null}
                  placeholder="Enter amount"
                />
              </div>
            )}
          </section>
        </div>

        {/* Right side: Receipt Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-lg border border-neutral-200 bg-white shadow-elevation-1">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Receipt Preview
              </h3>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4 text-sm">
              {/* Fee-settings error fallback notice */}
              {feeError && (
                <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning-fg">
                  Could not load fees from server — using defaults.
                </p>
              )}
              {/* Fixed fees — skeleton while loading */}
              {feeLoading ? (
                <>
                  <div className="flex items-center justify-between">
                    <Skeleton variant="block" width="120px" height="14px" />
                    <Skeleton variant="block" width="72px" height="14px" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton variant="block" width="96px" height="14px" />
                    <Skeleton variant="block" width="72px" height="14px" />
                  </div>
                </>
              ) : (
                <>
                  <LineItem label="Registration Fee" amount={registrationFee} />
                  <LineItem label="License Fee" amount={licenseFee} />
                </>
              )}

              {/* Subscription lines */}
              {state.subscriptions
                .filter((s) => s.amount > 0)
                .map((s) => (
                  <LineItem
                    key={s.disciplineId}
                    label={`${s.disciplineName} (${s.planType})`}
                    amount={s.amount}
                  />
                ))}

              {/* Equipment lines */}
              {state.equipmentSelections.map((e) => (
                <LineItem
                  key={e.equipmentId}
                  label={`${e.name} x${e.quantity}`}
                  amount={e.price * e.quantity}
                />
              ))}

              {/* Separator */}
              <div className="border-t border-neutral-200 pt-3">
                <div className="flex items-center justify-between font-semibold text-neutral-900">
                  <span>Grand Total</span>
                  <span>{formatDZD(grandTotal)}</span>
                </div>
              </div>

              {/* Payment info */}
              <div className="mt-2 flex flex-col gap-1 rounded-md bg-neutral-50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600">Payment</span>
                  <span className="font-medium capitalize text-neutral-900">
                    {state.paymentOption === 'full'
                      ? 'Full'
                      : state.paymentOption === 'partial'
                        ? 'Partial'
                        : 'Deferred'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600">Amount Paid</span>
                  <span className="font-medium text-success">{formatDZD(effectivePaid)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-600">Remaining</span>
                    <span className="font-medium text-warning">{formatDZD(remaining)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────── Line Item ──────── */

function LineItem({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between text-neutral-700">
      <span className="truncate pr-4">{label}</span>
      <span className="shrink-0 font-medium">{formatDZD(amount)}</span>
    </div>
  );
}
