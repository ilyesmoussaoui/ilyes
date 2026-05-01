import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatDateFr, getRelativeLabel } from '../dateHelpers';
import { formatDZD } from '../../payments/utils';
import type { AlertMember } from '../types';

const DOC_TYPE_LABELS_FR: Record<string, string> = {
  id_card: "Pièce d'identité",
  medical_certificate: 'Certificat médical',
  photo: 'Photo',
  birth_certificate: 'Acte de naissance',
  insurance: 'Assurance',
  parental_authorization: 'Autorisation parentale',
  belt_certificate: 'Certificat de ceinture',
  other: 'Autre',
};

function formatMissingDocs(types: string[]): string {
  return types.map((t) => DOC_TYPE_LABELS_FR[t] ?? t).join(', ');
}

function formatInactivity(days: number | undefined): string {
  if (days === undefined || days === null) return 'Jamais venu';
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Inactif depuis 1 jour';
  return `Inactif depuis ${days} jours`;
}

const API_BASE = import.meta.env.VITE_API_URL as string | undefined;

function resolvePhotoUrl(photoPath: string): string {
  const base = (API_BASE && API_BASE.trim()) || 'http://localhost:4000';
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
    return photoPath;
  }
  return `${base}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
}

interface MemberAvatarProps {
  photoPath?: string | null;
  firstName: string;
  lastName: string;
}

function MemberAvatar({ photoPath, firstName, lastName }: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  if (photoPath && !imgError) {
    return (
      <img
        src={resolvePhotoUrl(photoPath)}
        alt={`${firstName} ${lastName}`}
        className="h-16 w-16 shrink-0 rounded-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="h-16 w-16 shrink-0 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-base font-semibold select-none font-sans"
      aria-label={`Initiales: ${initials}`}
    >
      {initials}
    </div>
  );
}

interface AlertCardProps {
  member: AlertMember;
  accentBarClass: string;
  highlightParam: string;
  sectionKey: string;
}

export function AlertCard({ member, accentBarClass, highlightParam, sectionKey }: AlertCardProps) {
  const {
    memberId,
    firstNameLatin,
    lastNameLatin,
    firstNameArabic,
    lastNameArabic,
    photoPath,
    discipline,
    renewalDate,
    extra,
  } = member;

  const showDate = sectionKey === 'renewalNeeded' || sectionKey === 'subscriptionsExpiring';
  const formattedDate = showDate ? formatDateFr(renewalDate) : null;
  const relative = showDate ? getRelativeLabel(renewalDate) : null;

  const arabicName =
    firstNameArabic && lastNameArabic
      ? `${firstNameArabic} ${lastNameArabic}`
      : firstNameArabic ?? lastNameArabic ?? null;

  const to = `/members/${memberId}${highlightParam ? `?highlight=${highlightParam}` : ''}`;

  return (
    <Link
      to={to}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-md border border-neutral-200',
        'bg-white shadow-elevation-1 cursor-pointer transition-all duration-200',
        'hover:shadow-elevation-2 hover:border-neutral-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        'focus-visible:ring-offset-2',
      )}
    >
      {/* Left accent bar */}
      <div
        className={cn('absolute left-0 inset-y-0 w-[3px] rounded-l-md', accentBarClass)}
        aria-hidden="true"
      />

      <MemberAvatar
        photoPath={photoPath}
        firstName={firstNameLatin}
        lastName={lastNameLatin}
      />

      <div className="min-w-0 flex-1 flex flex-col gap-1">
        {/* Top row: name + discipline badge */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-900 truncate">
            {firstNameLatin} {lastNameLatin}
          </span>
          {discipline && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 bg-neutral-50 whitespace-nowrap">
              {discipline}
            </span>
          )}
        </div>

        {/* Arabic subtitle */}
        {arabicName && (
          <span
            dir="rtl"
            className="text-xs font-arabic text-neutral-500 truncate block"
          >
            {arabicName}
          </span>
        )}

        {/* Date line (only for renewal/expiring sections) */}
        {formattedDate && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="font-medium text-neutral-700">{formattedDate}</span>
            {relative && (
              <span
                className={cn(relative.overdue ? 'text-danger' : 'text-neutral-400')}
              >
                · {relative.label}
              </span>
            )}
          </div>
        )}

        {/* Section-specific extra line */}
        {sectionKey === 'unpaidBalance' && extra?.balanceDue != null && (
          <div className="text-xs font-semibold text-danger tabular-nums">
            {formatDZD(extra.balanceDue)}
          </div>
        )}
        {sectionKey === 'inactiveMembers' && (
          <div className="text-xs text-neutral-500">
            {formatInactivity(extra?.daysInactive)}
          </div>
        )}
        {sectionKey === 'missingDocuments' && extra?.missingDocTypes?.length ? (
          <div className="text-xs text-neutral-500 truncate" title={formatMissingDocs(extra.missingDocTypes)}>
            <span className="font-medium text-neutral-700">Manque :</span>{' '}
            {formatMissingDocs(extra.missingDocTypes)}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function AlertCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3" aria-hidden="true">
      <Skeleton variant="avatar" width="64px" height="64px" />
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton variant="block" width="60%" height="14px" />
          <Skeleton variant="block" width="18%" height="14px" className="rounded-full" />
        </div>
        <Skeleton variant="block" width="40%" height="12px" />
        <Skeleton variant="block" width="30%" height="12px" />
      </div>
    </div>
  );
}
