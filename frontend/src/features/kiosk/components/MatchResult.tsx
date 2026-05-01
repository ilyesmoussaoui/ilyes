import { UserIcon, CheckIcon, AlertIcon, ClockIcon } from '../../../components/ui/Icon';
import { cn } from '../../../lib/cn';
import type { MatchResult as MatchResultType, MatchSuccess } from '../kioskApi';
import { ReceptionistControls } from './ReceptionistControls';
import { NoFaceDetected } from './NoFaceDetected';

interface MatchResultProps {
  result: MatchResultType | null;
  isProcessing: boolean;
  noFaceTimeout: boolean;
  autoCheckInCountdown: number | null;
  onConfirmCheckIn: () => void;
  onReject: () => void;
  onCountdownTick: (v: number | null) => void;
  onDismiss: () => void;
  confirmDisabled?: boolean;
}

function formatCurrency(centimes: number): string {
  const dzd = centimes / 100;
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dzd) + ' DZD';
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/* ──── Idle state ──── */
function IdleState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-neutral-600 text-neutral-500">
        <UserIcon size={64} />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white">Stand in Front of the Camera</h2>
        <p className="mt-3 text-xl text-neutral-400">
          Face recognition will identify you automatically
        </p>
      </div>
    </div>
  );
}

/* ──── Scanning state ──── */
function ScanningState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center" role="status" aria-live="polite">
      <div className="relative">
        <div className="h-24 w-24 animate-pulse rounded-full bg-primary-500/20" />
        <div className="absolute inset-2 flex items-center justify-center rounded-full bg-primary-500/30">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-400/30 border-t-primary-400" />
        </div>
      </div>
      <h2 className="text-3xl font-bold text-white">Scanning...</h2>
      <p className="text-xl text-neutral-400">Please hold still</p>
    </div>
  );
}

/* ──── Success card ──── */
function SuccessCard({
  result,
  autoCheckInCountdown,
  onConfirm,
  onReject,
  onCountdownTick,
  confirmDisabled,
}: {
  result: MatchSuccess;
  autoCheckInCountdown: number | null;
  onConfirm: () => void;
  onReject: () => void;
  onCountdownTick: (v: number | null) => void;
  confirmDisabled: boolean;
}) {
  const { member, subscriptionStatus, expiryDate, outstandingBalance, alreadyCheckedIn, lastCheckInTime, canAutoCheckIn } = result;
  const fullNameLatin = `${member.firstNameLatin} ${member.lastNameLatin}`;
  const fullNameArabic = member.firstNameArabic && member.lastNameArabic
    ? `${member.firstNameArabic} ${member.lastNameArabic}`
    : null;

  // Determine card variant based on status
  if (alreadyCheckedIn) {
    return (
      <DuplicateCard
        name={fullNameLatin}
        nameArabic={fullNameArabic}
        photoPath={member.photoPath}
        lastCheckInTime={lastCheckInTime}
        onDismiss={onReject}
      />
    );
  }

  if (subscriptionStatus === 'expired') {
    return (
      <ExpiredCard
        name={fullNameLatin}
        nameArabic={fullNameArabic}
        photoPath={member.photoPath}
        expiryDate={expiryDate}
        onDismiss={onReject}
      />
    );
  }

  if (outstandingBalance > 0) {
    return (
      <UnpaidCard
        name={fullNameLatin}
        nameArabic={fullNameArabic}
        photoPath={member.photoPath}
        outstandingBalance={outstandingBalance}
        onConfirm={onConfirm}
        onReject={onReject}
        confirmDisabled={confirmDisabled}
      />
    );
  }

  // Active subscription - show welcome
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-8 shadow-2xl">
      {/* Member photo */}
      <MemberPhoto photoPath={member.photoPath} name={fullNameLatin} size="large" />

      {/* Member name */}
      <div className="text-center">
        <h2 className="text-4xl font-bold text-white lg:text-5xl">{fullNameLatin}</h2>
        {fullNameArabic && (
          <p className="mt-1 font-arabic text-2xl font-semibold text-green-100 lg:text-3xl" dir="rtl">
            {fullNameArabic}
          </p>
        )}
      </div>

      {/* Disciplines */}
      {member.disciplines.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {member.disciplines.map((d) => (
            <span
              key={d}
              className="rounded-full bg-green-500/30 px-4 py-1.5 text-base font-medium text-green-100"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Welcome message */}
      <div className="flex items-center gap-3 text-2xl font-bold text-white">
        <CheckIcon size={32} />
        Welcome!
      </div>

      {/* Receptionist controls */}
      <div className="w-full">
        <ReceptionistControls
          canAutoCheckIn={canAutoCheckIn}
          countdown={autoCheckInCountdown}
          onConfirm={onConfirm}
          onReject={onReject}
          onCountdownTick={onCountdownTick}
          disabled={confirmDisabled}
        />
      </div>
    </div>
  );
}

/* ──── Expired card ──── */
function ExpiredCard({
  name,
  nameArabic,
  photoPath,
  expiryDate,
  onDismiss,
}: {
  name: string;
  nameArabic: string | null;
  photoPath: string | null;
  expiryDate: string | null;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 shadow-2xl" role="alert">
      <MemberPhoto photoPath={photoPath} name={name} size="large" />
      <div className="text-center">
        <h2 className="text-4xl font-bold text-white">{name}</h2>
        {nameArabic && (
          <p className="mt-1 font-arabic text-2xl font-semibold text-red-100" dir="rtl">{nameArabic}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-2xl font-bold text-white">
        <AlertIcon size={32} />
        Subscription Expired
      </div>
      {expiryDate && (
        <p className="text-lg text-red-100">
          Expired on {new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-xl border-2 border-white/40 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-red-700"
      >
        Dismiss
      </button>
    </div>
  );
}

/* ──── Unpaid card ──── */
function UnpaidCard({
  name,
  nameArabic,
  photoPath,
  outstandingBalance,
  onConfirm,
  onReject,
  confirmDisabled,
}: {
  name: string;
  nameArabic: string | null;
  photoPath: string | null;
  outstandingBalance: number;
  onConfirm: () => void;
  onReject: () => void;
  confirmDisabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-8 shadow-2xl" role="alert">
      <MemberPhoto photoPath={photoPath} name={name} size="large" />
      <div className="text-center">
        <h2 className="text-4xl font-bold text-neutral-900">{name}</h2>
        {nameArabic && (
          <p className="mt-1 font-arabic text-2xl font-semibold text-amber-900" dir="rtl">{nameArabic}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-2xl font-bold text-neutral-900">
        <AlertIcon size={32} />
        Outstanding Balance
      </div>
      <p className="text-3xl font-bold text-neutral-900">{formatCurrency(outstandingBalance)}</p>
      <div className="flex w-full gap-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="flex-1 rounded-2xl bg-neutral-900 px-8 py-5 text-xl font-bold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600 disabled:opacity-50"
        >
          Proceed to Payment?
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded-2xl border-2 border-neutral-900 px-8 py-5 text-xl font-bold text-neutral-900 transition-colors hover:bg-neutral-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ──── Duplicate check-in card ──── */
function DuplicateCard({
  name,
  nameArabic,
  photoPath,
  lastCheckInTime,
  onDismiss,
}: {
  name: string;
  nameArabic: string | null;
  photoPath: string | null;
  lastCheckInTime: string | null;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-500 p-8 shadow-2xl" role="alert">
      <MemberPhoto photoPath={photoPath} name={name} size="large" />
      <div className="text-center">
        <h2 className="text-4xl font-bold text-neutral-900">{name}</h2>
        {nameArabic && (
          <p className="mt-1 font-arabic text-2xl font-semibold text-amber-900" dir="rtl">{nameArabic}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-2xl font-bold text-neutral-900">
        <ClockIcon size={32} />
        Already Checked In
      </div>
      {lastCheckInTime && (
        <p className="text-xl text-neutral-800">
          Checked in at <span className="font-bold">{formatTime(lastCheckInTime)}</span>
        </p>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-xl border-2 border-neutral-900/40 px-8 py-4 text-lg font-semibold text-neutral-900 transition-colors hover:bg-neutral-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
      >
        Dismiss
      </button>
    </div>
  );
}

/* ──── No match card ──── */
function NoMatchCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-neutral-700 bg-neutral-800 p-8 shadow-2xl">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-700 text-neutral-400">
        <UserIcon size={48} />
      </div>
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">Face Not Recognized</h2>
        <p className="mt-2 text-xl text-neutral-400">
          We couldn&apos;t match your face. Please try again or use manual search.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl bg-primary-500 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
      >
        Try Again
      </button>
    </div>
  );
}

/* ──── Member photo helper ──── */
function MemberPhoto({
  photoPath,
  name,
  size = 'large',
}: {
  photoPath: string | null;
  name: string;
  size?: 'medium' | 'large';
}) {
  const sizeClasses = size === 'large' ? 'h-28 w-28 text-5xl' : 'h-20 w-20 text-3xl';
  const borderClasses = 'border-4 border-white/30';

  if (photoPath) {
    return (
      <img
        src={photoPath}
        alt={`Photo of ${name}`}
        className={cn('rounded-full object-cover', sizeClasses, borderClasses)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-white/20 font-bold text-white',
        sizeClasses,
        borderClasses,
      )}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ──── Main component ──── */
export function MatchResultDisplay({
  result,
  isProcessing,
  noFaceTimeout,
  autoCheckInCountdown,
  onConfirmCheckIn,
  onReject,
  onCountdownTick,
  onDismiss,
  confirmDisabled = false,
}: MatchResultProps) {
  // No result and not processing
  if (!result && !isProcessing) {
    if (noFaceTimeout) {
      return <NoFaceDetected />;
    }
    return <IdleState />;
  }

  // Processing/scanning
  if (isProcessing && !result) {
    return <ScanningState />;
  }

  // We have a result
  if (!result) return <IdleState />;

  // Failed match
  if (!result.matched) {
    if (result.reason === 'no_face') {
      return <NoFaceDetected />;
    }
    return <NoMatchCard onRetry={onDismiss} />;
  }

  // Successful match (with various statuses)
  return (
    <SuccessCard
      result={result}
      autoCheckInCountdown={autoCheckInCountdown}
      onConfirm={onConfirmCheckIn}
      onReject={onReject}
      onCountdownTick={onCountdownTick}
      confirmDisabled={confirmDisabled}
    />
  );
}
