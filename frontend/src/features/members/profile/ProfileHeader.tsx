import { useState } from 'react';
import { Badge } from '../../../components/ui';
import type { MemberProfile } from './profileTypes';
import { formatMoney } from './profileUtils';
import { CollectPaymentModal } from '../../payments/components/CollectPaymentModal';

interface ProfileHeaderProps {
  profile: MemberProfile;
  onRefresh?: () => void;
}

function getInitials(profile: MemberProfile): string {
  const first = profile.firstNameLatin ?? profile.firstNameArabic ?? '';
  const last = profile.lastNameLatin ?? profile.lastNameArabic ?? '';
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?';
}

function getDisplayName(profile: MemberProfile): string {
  const latin = [profile.firstNameLatin, profile.lastNameLatin].filter(Boolean).join(' ');
  const arabic = [profile.firstNameArabic, profile.lastNameArabic].filter(Boolean).join(' ');
  return latin || arabic || 'Unknown Member';
}

function getArabicName(profile: MemberProfile): string {
  return [profile.firstNameArabic, profile.lastNameArabic].filter(Boolean).join(' ');
}

function getMemberTypeBadge(type: MemberProfile['type']): string {
  switch (type) {
    case 'athlete': return 'Athlete';
    case 'staff': return 'Staff';
    case 'external': return 'External';
  }
}

function statusToVariant(status: string): 'active' | 'inactive' | 'suspended' | 'expired' | 'pending' {
  switch (status.toLowerCase()) {
    case 'active': return 'active';
    case 'inactive': return 'inactive';
    case 'suspended': return 'suspended';
    case 'expired': return 'expired';
    default: return 'pending';
  }
}

const TYPE_COLORS: Record<MemberProfile['type'], string> = {
  athlete: 'bg-primary-100 text-primary-700 border border-primary-200',
  staff: 'bg-info-bg text-info-fg border border-info/20',
  external: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
};

export function ProfileHeader({ profile, onRefresh }: ProfileHeaderProps) {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const photoUrl = profile.photoPath
    ? `/api/v1/files/photos/${profile.photoPath}`
    : null;

  const arabicName = getArabicName(profile);
  const displayName = getDisplayName(profile);
  const hasBalance = profile.balance > 0;

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-r from-primary-50 via-white to-primary-50 shadow-elevation-1">
        {/* subtle decorative pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_1px_1px,var(--color-primary-400)_1px,transparent_0)] bg-[length:20px_20px]"
        />

        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          {/* Photo / Initials */}
          <div className="shrink-0 self-start sm:self-auto">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${displayName} photo`}
                className="h-20 w-20 rounded-full border-2 border-white object-cover shadow-elevation-2 sm:h-24 sm:w-24"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-2xl font-bold text-neutral-500 shadow-elevation-2 sm:h-24 sm:w-24"
              >
                {getInitials(profile)}
              </div>
            )}
          </div>

          {/* Name + Meta */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <h1 className="text-xl font-bold leading-tight text-neutral-900 sm:text-2xl">
                {displayName}
              </h1>
              <Badge
                variant={statusToVariant(profile.status)}
                label={profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
              />
            </div>

            {arabicName && (
              <p className="font-arabic mt-0.5 text-sm text-neutral-500 sm:text-base" dir="rtl">
                {arabicName}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[profile.type]}`}
              >
                {getMemberTypeBadge(profile.type)}
              </span>
              <span className="text-xs text-neutral-400">
                Member since{' '}
                {new Date(profile.createdAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Balance */}
          <div className="shrink-0 self-start sm:self-auto sm:text-right">
            {hasBalance ? (
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="group flex flex-col items-end gap-0.5 rounded-lg border border-danger/20 bg-danger-bg px-4 py-2.5 transition-all hover:border-danger/40 hover:shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                aria-label={`Outstanding balance: ${formatMoney(profile.balance)}. Click to record payment.`}
              >
                <span className="text-xs font-medium text-danger-fg/70">Outstanding balance</span>
                <span className="text-lg font-bold text-danger-fg">{formatMoney(profile.balance)}</span>
                <span className="text-xs text-danger-fg/60 group-hover:text-danger-fg/90 transition-colors">
                  Record payment →
                </span>
              </button>
            ) : (
              <div className="flex flex-col items-end gap-0.5 rounded-lg border border-success/20 bg-success-bg px-4 py-2.5">
                <span className="text-xs font-medium text-success-fg/70">Balance</span>
                <span className="text-lg font-bold text-success-fg">0.00 DZD</span>
                <span className="text-xs text-success-fg/60">All paid</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <CollectPaymentModal
        open={paymentModalOpen}
        memberId={profile.id}
        memberName={displayName}
        outstandingBalance={profile.balance}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => onRefresh?.()}
      />
    </>
  );
}
