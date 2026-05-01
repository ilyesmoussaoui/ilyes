import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Modal, Button, Badge } from '../../../components/ui';
import { ClockIcon, UserIcon } from '../../../components/ui/Icon';
import type { PresentRecord } from '../attendanceApi';
import { checkOutMember } from '../attendanceApi';
import { useToast } from '../../../components/ui';
import { getInitials, paymentBadgeVariant } from '../utils';
import { queueAttendanceCheckOut } from '../../../lib/offline/offlineApi';
import { shouldFallbackOffline, isOffline } from '../../../lib/offline-fallback';

interface MemberPopupProps {
  record: PresentRecord | null;
  onClose: () => void;
  onCheckout: (recordId: string) => void;
}

function formatCheckInTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Less than a minute';
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours === 0) return `${remainMins} min`;
  if (remainMins === 0) return `${hours}h`;
  return `${hours}h ${remainMins}m`;
}

export function MemberPopup({ record, onClose, onCheckout }: MemberPopupProps) {
  const [checkingOut, setCheckingOut] = useState(false);
  const toast = useToast();

  const duration = useMemo(
    () => (record ? formatDuration(record.checkInTime) : ''),
    [record],
  );

  if (!record) return null;

  const { member, discipline, checkInTime, method } = record;
  const initials = getInitials(member.firstNameLatin, member.lastNameLatin);

  const handleCheckout = async () => {
    setCheckingOut(true);
    const memberLabel = `${member.firstNameLatin} ${member.lastNameLatin}`;

    const queueOffline = async () => {
      await queueAttendanceCheckOut({ attendanceId: record.id, memberLabel });
      toast.show({
        type: 'success',
        title: 'Saved offline',
        description: `${memberLabel} will be checked out when the connection returns.`,
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
        title: 'Checked out',
        description: `${memberLabel} has been checked out.`,
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
            title: 'Could not save offline',
            description: 'Local storage is unavailable. Try again.',
          });
        }
      } else {
        toast.show({
          type: 'error',
          title: 'Checkout failed',
          description: 'Could not check out member. Try again.',
        });
      }
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Member Details" size="sm">
      <div className="flex flex-col items-center gap-4">
        {/* Photo / Initials */}
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={`${member.firstNameLatin} ${member.lastNameLatin}`}
            loading="lazy"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-neutral-200"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-600 ring-2 ring-primary-200">
            {initials}
          </div>
        )}

        {/* Name (Latin + Arabic) */}
        <div className="text-center">
          <h3 className="text-base font-semibold text-neutral-900">
            {member.firstNameLatin} {member.lastNameLatin}
          </h3>
          {(member.firstNameArabic || member.lastNameArabic) && (
            <p className="mt-0.5 font-arabic text-sm text-neutral-500" dir="rtl">
              {member.firstNameArabic} {member.lastNameArabic}
            </p>
          )}
        </div>

        {/* Details grid */}
        <div className="w-full space-y-3 rounded-md bg-neutral-50 p-4">
          <DetailRow label="Membership" value={member.membershipType || 'N/A'} />
          <DetailRow
            label="Discipline"
            value={discipline?.name ?? 'No discipline'}
          />
          <DetailRow
            label="Check-in"
            value={formatCheckInTime(checkInTime)}
            icon={<ClockIcon size={14} className="text-neutral-400" />}
          />
          <DetailRow label="Duration" value={duration} />
          <DetailRow label="Method" value={method} />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Payment</span>
            <Badge variant={paymentBadgeVariant(member.paymentStatus)} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex w-full gap-2">
          <Button
            variant="danger"
            fullWidth
            onClick={() => void handleCheckout()}
            loading={checkingOut}
          >
            Check Out
          </Button>
          <Link
            to={`/members/${member.id}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-primary-300 bg-white text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
          >
            <UserIcon size={16} className="mr-2" />
            View Profile
          </Link>
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-neutral-800 capitalize">
        {icon}
        {value}
      </span>
    </div>
  );
}
