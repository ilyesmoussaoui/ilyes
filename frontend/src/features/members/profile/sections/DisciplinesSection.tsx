import { Card, Badge } from '../../../../components/ui';
import type { MemberProfile, DisciplineEnrollment } from '../profileTypes';
import { ClockIcon, UserIcon } from '../../../../components/ui/Icon';

interface DisciplinesSectionProps {
  profile: MemberProfile;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeSinceEnrollment(enrollmentDate: string): string {
  const diff = Date.now() - new Date(enrollmentDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`;
}

function DisciplineCard({ discipline }: { discipline: DisciplineEnrollment }) {
  const statusVariant =
    discipline.status.toLowerCase() === 'active'
      ? 'active'
      : discipline.status.toLowerCase() === 'suspended'
      ? 'suspended'
      : 'inactive';

  const enrollmentDate = new Date(discipline.enrollmentDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeSince = timeSinceEnrollment(discipline.enrollmentDate);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-neutral-900">{discipline.disciplineName}</h3>
          {discipline.beltRank && (
            <p className="mt-0.5 text-xs text-neutral-500">
              Belt rank: <span className="font-medium text-neutral-700">{discipline.beltRank}</span>
            </p>
          )}
        </div>
        <Badge variant={statusVariant} label={discipline.status} />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <CalendarSmallIcon />
          <span>
            Enrolled <span className="font-medium text-neutral-700">{enrollmentDate}</span>
            <span className="ml-1.5 text-neutral-400">({timeSince})</span>
          </span>
        </div>

        {discipline.instructorName && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <UserIcon size={12} />
            <span>Instructor: <span className="text-neutral-700 font-medium">{discipline.instructorName}</span></span>
          </div>
        )}
      </div>

      {discipline.schedules.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">Schedule</p>
          <ul className="flex flex-wrap gap-1.5">
            {discipline.schedules.map((s) => (
              <li
                key={s.id}
                className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700"
              >
                <ClockIcon size={11} />
                <span>{DAY_NAMES[s.dayOfWeek]}</span>
                <span>{s.startTime}–{s.endTime}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CalendarSmallIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function DisciplinesSection({ profile }: DisciplinesSectionProps) {
  return (
    <section aria-labelledby="disciplines-heading">
      <h2 id="disciplines-heading" className="sr-only">Disciplines</h2>

      {profile.disciplines.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm font-medium text-neutral-700">No disciplines enrolled</p>
            <p className="text-xs text-neutral-500">This member has not been enrolled in any disciplines yet.</p>
          </div>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {profile.disciplines.map((d) => (
            <li key={d.id}>
              <DisciplineCard discipline={d} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
