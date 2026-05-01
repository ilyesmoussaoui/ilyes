import { Card } from '../../../../components/ui/Card';
import type { MemberProfile } from '../../profile/profileTypes';

interface ScheduleTabProps {
  profile: MemberProfile;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DISCIPLINE_COLORS = [
  'bg-primary-100 text-primary-800 border-primary-200',
  'bg-info-bg text-info-fg border-info/20',
  'bg-success-bg text-success-fg border-success/20',
  'bg-warning-bg text-warning-fg border-warning/20',
  'bg-purple-50 text-purple-800 border-purple-200',
  'bg-pink-50 text-pink-800 border-pink-200',
];

interface ScheduleEntry {
  disciplineName: string;
  startTime: string;
  endTime: string;
  disciplineIndex: number;
}

export function ScheduleTab({ profile }: ScheduleTabProps) {
  const byDay = new Map<number, ScheduleEntry[]>();
  const disciplineNames = profile.disciplines.map((d) => d.disciplineName);

  profile.disciplines.forEach((discipline) => {
    const colorIdx =
      disciplineNames.indexOf(discipline.disciplineName) %
      DISCIPLINE_COLORS.length;
    discipline.schedules.forEach((sched) => {
      if (!byDay.has(sched.dayOfWeek)) byDay.set(sched.dayOfWeek, []);
      byDay.get(sched.dayOfWeek)!.push({
        disciplineName: discipline.disciplineName,
        startTime: sched.startTime,
        endTime: sched.endTime,
        disciplineIndex: colorIdx,
      });
    });
  });

  for (const entries of byDay.values()) {
    entries.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const activeDays = Array.from(byDay.keys()).sort();
  const hasSchedule = activeDays.length > 0;

  return (
    <section aria-labelledby="schedule-tab-heading">
      <h2 id="schedule-tab-heading" className="sr-only">
        Weekly Schedule
      </h2>

      <div className="mb-4 rounded-md border border-info/20 bg-info-bg px-4 py-2.5">
        <p className="text-xs font-medium text-info-fg">
          Schedule is derived from discipline enrollments. Edit schedules by
          modifying enrollments in the Disciplines tab.
        </p>
      </div>

      {!hasSchedule ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">
              No scheduled sessions
            </p>
            <p className="text-xs text-neutral-500">
              Add disciplines with schedules to see them here.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Color legend */}
          <div className="mb-4 flex flex-wrap gap-2">
            {profile.disciplines.map((d, idx) => (
              <span
                key={d.id}
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${DISCIPLINE_COLORS[idx % DISCIPLINE_COLORS.length]}`}
              >
                {d.disciplineName}
              </span>
            ))}
          </div>

          {/* Desktop: 7-column grid */}
          <div className="hidden sm:grid sm:grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, dayIdx) => {
              const entries = byDay.get(dayIdx) ?? [];
              const isActive = entries.length > 0;
              return (
                <div
                  key={dayIdx}
                  className={`rounded-lg border p-2 ${
                    isActive
                      ? 'border-primary-200 bg-primary-50/30'
                      : 'border-neutral-100 bg-neutral-50'
                  }`}
                >
                  <p
                    className={`mb-2 text-xs font-semibold ${
                      isActive ? 'text-primary-700' : 'text-neutral-400'
                    }`}
                  >
                    {DAY_SHORT[dayIdx]}
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-xs text-neutral-300">—</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {entries.map((entry, i) => (
                        <li
                          key={i}
                          className={`rounded border px-1.5 py-1 text-xs ${DISCIPLINE_COLORS[entry.disciplineIndex]}`}
                        >
                          <p className="font-medium truncate">
                            {entry.disciplineName}
                          </p>
                          <p className="opacity-80">
                            {entry.startTime}–{entry.endTime}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: list by day */}
          <ul className="sm:hidden flex flex-col gap-3">
            {activeDays.map((dayIdx) => {
              const entries = byDay.get(dayIdx) ?? [];
              return (
                <li key={dayIdx}>
                  <Card padding="sm">
                    <p className="mb-2 text-sm font-semibold text-neutral-900">
                      {DAY_NAMES[dayIdx]}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {entries.map((entry, i) => (
                        <li
                          key={i}
                          className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-sm ${DISCIPLINE_COLORS[entry.disciplineIndex]}`}
                        >
                          <span className="font-medium">
                            {entry.disciplineName}
                          </span>
                          <span className="text-xs opacity-80">
                            {entry.startTime}–{entry.endTime}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
