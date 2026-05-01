/**
 * CheckActionModal — shown when a staff member clicks a tile in the PresenceGrid.
 *
 * Two large buttons:
 *   • Arrivée  → fires check-in API (only relevant if the member isn't present yet,
 *                but this modal is also reachable from search picker flows)
 *   • Départ   → fires checkout for the attendanceId stored in the record
 *
 * Toast on success: "Arrivée enregistrée." / "Départ enregistré."
 */

import { useState, useMemo } from 'react';
import { Modal } from '../../../components/ui';
import { ClockIcon } from '../../../components/ui/Icon';
import { useToast } from '../../../components/ui';
import type { PresentRecord } from '../attendanceApi';
import { checkOutMember } from '../attendanceApi';
import { getInitials } from '../utils';
import { queueAttendanceCheckOut } from '../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../lib/offline-fallback';

interface CheckActionModalProps {
  record: PresentRecord | null;
  onClose: () => void;
  /** Called after a checkout is confirmed so parent can remove record from grid. */
  onCheckout: (recordId: string) => void;
}

function formatCheckInTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours === 0) return `${remainMins} min`;
  if (remainMins === 0) return `${hours}h`;
  return `${hours}h ${remainMins}m`;
}

export function CheckActionModal({ record, onClose, onCheckout }: CheckActionModalProps) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const duration = useMemo(
    () => (record ? formatDuration(record.checkInTime) : ''),
    [record],
  );

  if (!record) return null;

  const { member, checkInTime } = record;
  const initials = getInitials(member.firstNameLatin, member.lastNameLatin);
  const fullName = `${member.firstNameLatin} ${member.lastNameLatin}`;

  const handleCheckout = async () => {
    setLoading(true);

    const queueOffline = async () => {
      await queueAttendanceCheckOut({ attendanceId: record.id, memberLabel: fullName });
      toast.show({
        type: 'success',
        title: 'Départ enregistré.',
        description: `${fullName} sera déconnecté dès le retour en ligne.`,
      });
      onCheckout(record.id);
      onClose();
    };

    try {
      if (isOffline()) {
        await queueOffline();
        return;
      }
      await checkOutMember(record.id);
      toast.show({
        type: 'success',
        title: 'Départ enregistré.',
      });
      onCheckout(record.id);
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
          title: 'Échec du départ',
          description: "Impossible d'enregistrer le départ. Réessayez.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm" closeOnOverlay>
      <div className="flex flex-col items-center gap-5">
        {/* Avatar */}
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={fullName}
            loading="lazy"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-neutral-200"
          />
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700 ring-2 ring-primary-200"
            aria-hidden="true"
          >
            {initials}
          </div>
        )}

        {/* Name */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-neutral-900">{fullName}</h2>
          {(member.firstNameArabic || member.lastNameArabic) && (
            <p className="mt-0.5 font-arabic text-sm text-neutral-500" dir="rtl">
              {member.firstNameArabic} {member.lastNameArabic}
            </p>
          )}
        </div>

        {/* Check-in info */}
        <div className="flex w-full items-center justify-between rounded-md bg-neutral-50 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <ClockIcon size={14} aria-hidden="true" />
            Arrivée à {formatCheckInTime(checkInTime)}
          </span>
          <span className="font-medium text-neutral-700">{duration}</span>
        </div>

        {/* Action buttons */}
        <div className="grid w-full grid-cols-2 gap-3">
          {/* Arrivée — disabled for already-present tiles (info only) */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-success/30 bg-success-bg px-4 py-4 text-sm font-semibold text-success-fg opacity-50 cursor-not-allowed select-none"
            aria-label="Arrivée déjà enregistrée"
          >
            {/* Arrow-in icon */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Arrivée
          </button>

          {/* Départ */}
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={loading}
            className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-danger/30 bg-danger-bg px-4 py-4 text-sm font-semibold text-danger-fg transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Enregistrer le départ"
          >
            {loading ? (
              <svg
                className="h-6 w-6 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            ) : (
              /* Arrow-out icon */
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
            Départ
          </button>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg py-2 text-sm text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          Annuler
        </button>
      </div>
    </Modal>
  );
}
