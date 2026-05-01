import { useMemo, type KeyboardEvent } from 'react';
import { Badge } from '../../../components/ui';
import { ClockIcon } from '../../../components/ui/Icon';
import type { PresentRecord } from '../attendanceApi';
import { getInitials, paymentBadgeVariant } from '../utils';

interface MemberTileProps {
  record: PresentRecord;
  onSelect: (record: PresentRecord) => void;
}

function getElapsedMinutes(checkInTime: string): number {
  const checkIn = new Date(checkInTime);
  const now = new Date();
  return Math.floor((now.getTime() - checkIn.getTime()) / 60_000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h ago`;
  return `${hours}h ${mins}m ago`;
}

function getDurationTier(minutes: number): 'green' | 'yellow' | 'red' {
  if (minutes < 120) return 'green';
  if (minutes < 240) return 'yellow';
  return 'red';
}

const TIER_BORDER: Record<ReturnType<typeof getDurationTier>, string> = {
  green: 'border-success/40 hover:border-success/60',
  yellow: 'border-warning/40 hover:border-warning/60',
  red: 'border-danger/40 hover:border-danger/60',
};

const TIER_RING: Record<ReturnType<typeof getDurationTier>, string> = {
  green: 'focus-visible:ring-success/30',
  yellow: 'focus-visible:ring-warning/30',
  red: 'focus-visible:ring-danger/30',
};

export function MemberTile({ record, onSelect }: MemberTileProps) {
  const elapsed = useMemo(() => getElapsedMinutes(record.checkInTime), [record.checkInTime]);
  const tier = getDurationTier(elapsed);
  const initials = getInitials(record.member.firstNameLatin, record.member.lastNameLatin);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(record);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(record)}
      onKeyDown={handleKeyDown}
      aria-label={`${record.member.firstNameLatin} ${record.member.lastNameLatin}, checked in ${formatElapsed(elapsed)}`}
      className={`group flex cursor-pointer flex-col rounded-lg border-2 bg-white p-3 shadow-elevation-1 transition-all hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${TIER_BORDER[tier]} ${TIER_RING[tier]}`}
    >
      {/* Top row: avatar + info */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {record.member.photoUrl ? (
          <img
            src={record.member.photoUrl}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
            {initials}
          </div>
        )}

        {/* Name + discipline */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {record.member.firstNameLatin} {record.member.lastNameLatin}
          </p>
          {record.discipline && (
            <p className="truncate text-xs text-neutral-500">
              {record.discipline.name}
            </p>
          )}
        </div>
      </div>

      {/* Bottom row: time + badge */}
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
          <ClockIcon size={12} />
          {formatElapsed(elapsed)}
        </span>
        <Badge variant={paymentBadgeVariant(record.member.paymentStatus)} />
      </div>
    </div>
  );
}
