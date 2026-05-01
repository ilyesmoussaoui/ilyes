/**
 * CheckInModal — Manuel check-in with pre-check gates.
 *
 * STUB NOTE (Phase 3 TODO):
 * Pre-check gates currently use getDashboardAlerts() + getPresentMembers()
 * as a proxy for member state. This is best-effort and eventually should be
 * replaced by a dedicated endpoint:
 *   GET /members/:id/check-in-state
 *   → { unpaidBalance: number, subscriptionStatus, expiresAt, alreadyCheckedIn, lastCheckInTime }
 *
 * Gate logic:
 *   1. Expired subscription  → red block, no confirm
 *   2. Unpaid balance        → red block, navigate to billing or POS
 *   3. Expiring ≤ 4 days     → yellow warning above confirm (non-blocking)
 *   4. Duplicate check-in   → red block, offer Départ
 *   5. Offline               → yellow banner (non-blocking, queues locally)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Input, Select } from '../../../components/ui';
import { AlertIcon } from '../../../components/ui/Icon';
import { useToast } from '../../../components/ui';
import { checkInMember, checkOutMember, getPresentMembers } from '../attendanceApi';
import { searchMembers, getDisciplines } from '../../members/api/membersApi';
import type { SearchMemberResult, Discipline } from '../../members/api/membersApi';
import { api } from '../../../lib/api';
import type { DashboardAlertsData } from '../../dashboard/types';
import { queueAttendanceCheckIn, queueAttendanceCheckOut } from '../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../lib/offline-fallback';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */

interface CheckInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type GateStatus = 'idle' | 'loading' | 'ready';

interface MemberState {
  unpaidBalance: boolean;
  subscriptionExpired: boolean;
  expiringInDays: number | null; // null = not expiring soon, N = days until expiry
  alreadyCheckedIn: boolean;
  lastCheckInTime: string | null;
  attendanceId: string | null; // for checkout when duplicate
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helper — format HHhMM for duplicate gate
───────────────────────────────────────────────────────────────────────────── */
function formatHHhMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}h${mm}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   STUB — resolve member state from dashboard alerts + present list
   Phase 3: replace with GET /members/:id/check-in-state
───────────────────────────────────────────────────────────────────────────── */
async function resolveMemberState(memberId: string): Promise<MemberState> {
  const [alertsResult, presentResult] = await Promise.allSettled([
    api.get<DashboardAlertsData>(
      '/dashboard/alerts?expiringWindowDays=14&inactiveThresholdDays=30&limitPerCategory=20',
    ),
    getPresentMembers(),
  ]);

  const alerts: DashboardAlertsData | null =
    alertsResult.status === 'fulfilled' ? alertsResult.value : null;
  const present = presentResult.status === 'fulfilled' ? presentResult.value.records : [];

  // Unpaid balance check
  const unpaidBalance = alerts
    ? alerts.unpaidBalance.some((m) => m.memberId === memberId)
    : false;

  // Expired subscription
  const subscriptionExpired = alerts
    ? alerts.renewalNeeded.some((m) => m.memberId === memberId)
    : false;

  // Expiring soon (≤ 4 days) — use subscriptionsExpiring from alerts
  // The renewalDate field gives us the expiry date
  let expiringInDays: number | null = null;
  if (alerts) {
    const expiring = alerts.subscriptionsExpiring.find((m) => m.memberId === memberId);
    if (expiring?.renewalDate) {
      const diff = new Date(expiring.renewalDate).getTime() - Date.now();
      const days = Math.ceil(diff / 86_400_000);
      if (days >= 0 && days <= 4 && !subscriptionExpired) {
        expiringInDays = days;
      }
    }
  }

  // Duplicate check-in
  const presentRecord = present.find((r) => r.memberId === memberId);
  const alreadyCheckedIn = !!presentRecord;

  return {
    unpaidBalance,
    subscriptionExpired,
    expiringInDays,
    alreadyCheckedIn,
    lastCheckInTime: presentRecord?.checkInTime ?? null,
    attendanceId: presentRecord?.id ?? null,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Gate cards
───────────────────────────────────────────────────────────────────────────── */

function ExpiredGate() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm"
    >
      <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
      <p className="font-medium text-danger-fg">
        Abonnement expiré – accès refusé. Contactez le personnel.
      </p>
    </div>
  );
}

function UnpaidGate({ memberId, onCancel }: { memberId: string; onCancel: () => void }) {
  const navigate = useNavigate();
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-3">
        <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
        <p className="font-medium text-danger-fg">
          Solde impayé. Accès refusé. Contactez le personnel. Procéder au paiement ?
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(`/members/${memberId}?highlight=billing`)}
          className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
        >
          Continuer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger-fg transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function ExpiringWarning({ days }: { days: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm"
    >
      <AlertIcon size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <p className="font-medium text-warning-fg">
        Abonnement expirant dans {days} jour{days > 1 ? 's' : ''}.
      </p>
    </div>
  );
}

function DuplicateGate({
  lastCheckInTime,
  attendanceId,
  memberLabel,
  onCheckout,
  onCancel,
}: {
  lastCheckInTime: string;
  attendanceId: string;
  memberLabel: string;
  onCheckout: () => void;
  onCancel: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const toast = useToast();

  const handleCheckout = async () => {
    setChecking(true);
    try {
      if (isOffline()) {
        await queueAttendanceCheckOut({ attendanceId, memberLabel });
        toast.show({ type: 'success', title: 'Départ enregistré.' });
        onCheckout();
        return;
      }
      await checkOutMember(attendanceId);
      toast.show({ type: 'success', title: 'Départ enregistré.' });
      onCheckout();
    } catch (err) {
      if (shouldFallbackOffline(err)) {
        try {
          await queueAttendanceCheckOut({ attendanceId, memberLabel });
          toast.show({ type: 'success', title: 'Départ enregistré.' });
          onCheckout();
          return;
        } catch {
          /* fall through */
        }
      }
      toast.show({ type: 'error', title: 'Échec du départ', description: 'Réessayez.' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-3">
        <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
        <p className="font-medium text-danger-fg">
          Arrivée en double détectée — déjà enregistré à {formatHHhMM(lastCheckInTime)}.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleCheckout()}
          disabled={checking}
          className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 disabled:opacity-50"
        >
          {checking ? 'En cours…' : 'Départ maintenant'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger-fg transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function OfflineWarning() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm"
    >
      <AlertIcon size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <p className="font-medium text-warning-fg">
        Hors ligne — l'arrivée est sauvegardée localement et sera synchronisée dès que vous serez en
        ligne.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main modal
───────────────────────────────────────────────────────────────────────────── */

export function CheckInModal({ open, onClose, onSuccess }: CheckInModalProps) {
  const toast = useToast();

  // Search state
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<SearchMemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Form state
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [disciplineId, setDisciplineId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Gate state
  const [gateStatus, setGateStatus] = useState<GateStatus>('idle');
  const [memberState, setMemberState] = useState<MemberState | null>(null);

  // Offline detection (reactive)
  const [browserOffline, setBrowserOffline] = useState(() => isOffline());

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /* ── Reactive offline status ── */
  useEffect(() => {
    const onOnline = () => setBrowserOffline(false);
    const onOffline = () => setBrowserOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  /* ── Load disciplines ── */
  useEffect(() => {
    if (!open) return;
    getDisciplines()
      .then((res) => setDisciplines(res.disciplines.filter((d) => d.isActive)))
      .catch(() => {/* non-critical */});
  }, [open]);

  /* ── Debounced member search ── */
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setMembers([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchMembers(q);
      setMembers(res.members);
    } catch {
      setMembers([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, doSearch]);

  /* ── Reset on close ── */
  useEffect(() => {
    if (!open) {
      setSearch('');
      setMembers([]);
      setSelectedMemberId(null);
      setDisciplineId(null);
      setNotes('');
      setGateStatus('idle');
      setMemberState(null);
    }
  }, [open]);

  /* ── Run gate checks when a member is selected ── */
  useEffect(() => {
    if (!selectedMemberId) {
      setGateStatus('idle');
      setMemberState(null);
      return;
    }

    setGateStatus('loading');
    resolveMemberState(selectedMemberId)
      .then((state) => {
        setMemberState(state);
        setGateStatus('ready');
      })
      .catch(() => {
        // Fail open — don't block check-in if we can't resolve state
        setMemberState(null);
        setGateStatus('ready');
      });
  }, [selectedMemberId]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  // Derive blocking gates
  const isBlocked =
    gateStatus === 'ready' &&
    memberState !== null &&
    (memberState.subscriptionExpired || memberState.unpaidBalance || memberState.alreadyCheckedIn);

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!selectedMemberId) return;
    setSubmitting(true);

    const memberLabel = selectedMember
      ? `${selectedMember.firstNameLatin} ${selectedMember.lastNameLatin}`
      : 'Membre';

    const checkInPayload = {
      memberId: selectedMemberId,
      disciplineId: disciplineId ?? undefined,
      method: 'manual' as const,
      notes: notes.trim() || undefined,
    };

    const queueOffline = async () => {
      await queueAttendanceCheckIn({ ...checkInPayload, memberLabel });
      toast.show({ type: 'success', title: 'Arrivée enregistrée.' });
      onSuccess();
      onClose();
    };

    try {
      if (isOffline()) {
        await queueOffline();
        return;
      }
      await checkInMember(checkInPayload);
      toast.show({ type: 'success', title: 'Arrivée enregistrée.' });
      onSuccess();
      onClose();
    } catch (err) {
      if (shouldFallbackOffline(err)) {
        try {
          await queueOffline();
          return;
        } catch {
          toast.show({
            type: 'error',
            title: 'Impossible de sauvegarder hors ligne',
            description: 'Le stockage local est indisponible. Réessayez.',
          });
        }
      } else {
        toast.show({
          type: 'error',
          title: "Échec de l'enregistrement",
          description: "Impossible d'enregistrer l'arrivée. Réessayez.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const disciplineOptions = disciplines.map((d) => ({ value: d.id, label: d.name }));

  return (
    <Modal open={open} onClose={onClose} title="Enregistrement manuel" size="md">
      <div className="flex flex-col gap-4">

        {/* ── Offline banner (non-blocking) ── */}
        {browserOffline && <OfflineWarning />}

        {/* ── Member search ── */}
        <div>
          <Input
            label="Rechercher un membre"
            placeholder="Saisir un nom…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedMemberId(null);
            }}
          />
          {searching && (
            <p className="mt-1 text-xs text-neutral-400" aria-live="polite">
              Recherche en cours…
            </p>
          )}

          {/* Results */}
          {members.length > 0 && !selectedMemberId && (
            <ul
              role="listbox"
              aria-label="Résultats de recherche"
              className="mt-2 max-h-40 overflow-auto rounded-md border border-neutral-200 bg-white shadow-elevation-1"
            >
              {members.map((m) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setSelectedMemberId(m.id);
                    setSearch(`${m.firstNameLatin} ${m.lastNameLatin}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMemberId(m.id);
                      setSearch(`${m.firstNameLatin} ${m.lastNameLatin}`);
                    }
                  }}
                  tabIndex={0}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-none"
                >
                  {m.photoUrl ? (
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                      {m.firstNameLatin.charAt(0)}
                      {m.lastNameLatin.charAt(0)}
                    </div>
                  )}
                  <span className="text-neutral-800">
                    {m.firstNameLatin} {m.lastNameLatin}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {search.length >= 2 && !searching && members.length === 0 && !selectedMemberId && (
            <p className="mt-1 text-xs text-neutral-500">Aucun membre trouvé.</p>
          )}
        </div>

        {/* ── Selected member pill ── */}
        {selectedMember && (
          <div className="flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2 text-sm">
            <span className="font-medium text-primary-700">
              {selectedMember.firstNameLatin} {selectedMember.lastNameLatin}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedMemberId(null);
                setSearch('');
              }}
              className="ml-auto rounded text-xs text-primary-500 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-400"
              aria-label="Changer de membre"
            >
              Changer
            </button>
          </div>
        )}

        {/* ── Gate checks ── */}
        {gateStatus === 'loading' && selectedMemberId && (
          <p className="text-xs text-neutral-400" aria-live="polite">
            Vérification des conditions d'accès…
          </p>
        )}

        {gateStatus === 'ready' && memberState && selectedMemberId && (
          <>
            {/* 1. Expired */}
            {memberState.subscriptionExpired && <ExpiredGate />}

            {/* 2. Unpaid (only show if not expired — both would be redundant) */}
            {!memberState.subscriptionExpired && memberState.unpaidBalance && (
              <UnpaidGate
                memberId={selectedMemberId}
                onCancel={onClose}
              />
            )}

            {/* 3. Duplicate */}
            {memberState.alreadyCheckedIn &&
              memberState.lastCheckInTime &&
              memberState.attendanceId && (
                <DuplicateGate
                  lastCheckInTime={memberState.lastCheckInTime}
                  attendanceId={memberState.attendanceId}
                  memberLabel={
                    selectedMember
                      ? `${selectedMember.firstNameLatin} ${selectedMember.lastNameLatin}`
                      : 'Membre'
                  }
                  onCheckout={() => {
                    onSuccess();
                    onClose();
                  }}
                  onCancel={onClose}
                />
              )}

            {/* 4. Expiring soon (non-blocking warning, shown above confirm button) */}
            {!memberState.subscriptionExpired &&
              !memberState.alreadyCheckedIn &&
              memberState.expiringInDays !== null && (
                <ExpiringWarning days={memberState.expiringInDays} />
              )}
          </>
        )}

        {/* ── Discipline ── */}
        <Select
          label="Discipline (facultatif)"
          options={disciplineOptions}
          value={disciplineId}
          onChange={setDisciplineId}
          placeholder="Sélectionner une discipline…"
        />

        {/* ── Notes ── */}
        <Input
          label="Notes (facultatif)"
          placeholder="Notes supplémentaires…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* ── Actions ── */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            loading={submitting}
            disabled={!selectedMemberId || gateStatus === 'loading' || isBlocked}
            aria-disabled={isBlocked}
          >
            Enregistrer l'arrivée
          </Button>
        </div>
      </div>
    </Modal>
  );
}
