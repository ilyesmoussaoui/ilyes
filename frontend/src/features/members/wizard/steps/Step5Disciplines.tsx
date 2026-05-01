import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { cn } from '../../../../lib/cn';
import { Select, Skeleton } from '../../../../components/ui';
import { AlertIcon, InfoIcon } from '../../../../components/ui/Icon';
import { useWizard } from '../useWizard';
import type { DisciplineEnrollment, ScheduleSelection } from '../wizardTypes';
import type { SelectOption } from '../../../../types/ui';
import {
  getDisciplines,
  getDisciplineTimeSlots,
  getDisciplineInstructors,
  enrollMemberDisciplines,
  type Discipline,
  type TimeSlot,
  type Instructor,
} from '../../api/membersApi';

const BELT_RANKS: SelectOption[] = [
  { value: 'White', label: 'White' },
  { value: 'Yellow', label: 'Yellow' },
  { value: 'Green', label: 'Green' },
  { value: 'Blue', label: 'Blue' },
  { value: 'Red', label: 'Red' },
  { value: 'Black', label: 'Black' },
];

const DAY_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_INDICES = [6, 0, 1, 2, 3, 4, 5]; // Sat=6, Sun=0, Mon=1... Fri=5

let clientIdCounter = 0;
function nextClientId(): string {
  clientIdCounter += 1;
  return `disc-${Date.now()}-${clientIdCounter}`;
}

interface DisciplineSlots {
  timeSlots: TimeSlot[];
  instructors: Instructor[];
  loading: boolean;
  error: string | null;
}

export function Step5Disciplines() {
  const { state, update, registerValidator, registerAdvanceHandler, notifyStepEvaluation } =
    useWizard();
  const baseId = useId();

  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Discipline-specific data keyed by disciplineId
  const [disciplineData, setDisciplineData] = useState<Record<string, DisciplineSlots>>({});

  // Fetch all disciplines on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDisciplines()
      .then((res) => {
        if (cancelled) return;
        setAllDisciplines(res.disciplines.filter((d) => d.isActive));
        setFetchError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to load disciplines');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch time slots and instructors when a discipline is selected
  const fetchDisciplineDetails = useCallback((disciplineId: string) => {
    setDisciplineData((prev) => ({
      ...prev,
      [disciplineId]: { timeSlots: [], instructors: [], loading: true, error: null },
    }));

    Promise.all([
      getDisciplineTimeSlots(disciplineId),
      getDisciplineInstructors(disciplineId),
    ])
      .then(([slotsRes, instructorsRes]) => {
        setDisciplineData((prev) => ({
          ...prev,
          [disciplineId]: {
            timeSlots: slotsRes.timeSlots,
            instructors: instructorsRes.instructors,
            loading: false,
            error: null,
          },
        }));
      })
      .catch((err) => {
        setDisciplineData((prev) => ({
          ...prev,
          [disciplineId]: {
            timeSlots: [],
            instructors: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load details',
          },
        }));
      });
  }, []);

  const toggleDiscipline = useCallback(
    (disc: Discipline) => {
      const exists = state.disciplines.find((d) => d.disciplineId === disc.id);
      if (exists) {
        update({
          disciplines: state.disciplines.filter((d) => d.disciplineId !== disc.id),
        });
      } else {
        const enrollment: DisciplineEnrollment = {
          id: nextClientId(),
          disciplineId: disc.id,
          disciplineName: disc.name,
          instructorId: null,
          beltRank: null,
          schedules: [],
        };
        update({ disciplines: [...state.disciplines, enrollment] });
        if (!disciplineData[disc.id]) {
          fetchDisciplineDetails(disc.id);
        }
      }
    },
    [state.disciplines, update, disciplineData, fetchDisciplineDetails],
  );

  const updateEnrollment = useCallback(
    (disciplineId: string, patch: Partial<DisciplineEnrollment>) => {
      update({
        disciplines: state.disciplines.map((d) =>
          d.disciplineId === disciplineId ? { ...d, ...patch } : d,
        ),
      });
    },
    [state.disciplines, update],
  );

  const toggleSchedule = useCallback(
    (disciplineId: string, slot: TimeSlot) => {
      const enrollment = state.disciplines.find((d) => d.disciplineId === disciplineId);
      if (!enrollment) return;

      const exists = enrollment.schedules.find(
        (s) => s.timeSlotId === slot.id,
      );
      const nextSchedules: ScheduleSelection[] = exists
        ? enrollment.schedules.filter((s) => s.timeSlotId !== slot.id)
        : [
            ...enrollment.schedules,
            {
              dayOfWeek: slot.dayOfWeek,
              timeSlotId: slot.id,
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
          ];
      updateEnrollment(disciplineId, { schedules: nextSchedules });
    },
    [state.disciplines, updateEnrollment],
  );

  // Conflict detection: overlapping time slots across disciplines
  const conflicts = useMemo(() => {
    const allSchedules: Array<{
      disciplineName: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }> = [];
    for (const disc of state.disciplines) {
      for (const sched of disc.schedules) {
        allSchedules.push({
          disciplineName: disc.disciplineName,
          dayOfWeek: sched.dayOfWeek,
          startTime: sched.startTime,
          endTime: sched.endTime,
        });
      }
    }
    const found: string[] = [];
    for (let i = 0; i < allSchedules.length; i++) {
      for (let j = i + 1; j < allSchedules.length; j++) {
        const a = allSchedules[i];
        const b = allSchedules[j];
        if (
          a.dayOfWeek === b.dayOfWeek &&
          a.disciplineName !== b.disciplineName &&
          a.startTime < b.endTime &&
          b.startTime < a.endTime
        ) {
          found.push(
            `${a.disciplineName} and ${b.disciplineName} overlap on ${DAY_NAMES[DAY_INDICES.indexOf(a.dayOfWeek)] ?? `Day ${a.dayOfWeek}`}`,
          );
        }
      }
    }
    return found;
  }, [state.disciplines]);

  // Total sessions across all disciplines
  const totalSessions = useMemo(
    () => state.disciplines.reduce((sum, d) => sum + d.schedules.length, 0),
    [state.disciplines],
  );

  // Validation
  const validationResult = useMemo(() => {
    const errors: Record<string, string> = {};
    if (state.disciplines.length === 0) {
      errors.disciplines = 'Select at least one discipline';
    }
    state.disciplines.forEach((d) => {
      if (d.schedules.length === 0) {
        errors[`schedule-${d.disciplineId}`] =
          `Select at least one schedule for ${d.disciplineName}`;
      }
    });
    const ok = Object.keys(errors).length === 0;
    return {
      ok,
      errors,
      firstInvalidFieldId: ok ? undefined : `${baseId}-disc-0`,
    };
  }, [state.disciplines, baseId]);

  useEffect(() => {
    notifyStepEvaluation('disciplines', validationResult.ok);
  }, [validationResult.ok, notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('disciplines', () => validationResult);
  }, [validationResult, registerValidator]);

  useEffect(() => {
    return registerAdvanceHandler('disciplines', async () => {
      if (!state.memberId) return false;
      await enrollMemberDisciplines(state.memberId, {
        enrollments: state.disciplines.map((d) => ({
          disciplineId: d.disciplineId,
          instructorId: d.instructorId,
          beltRank: d.beltRank,
          schedules: d.schedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            timeSlotId: s.timeSlotId,
          })),
        })),
      });
      return true;
    });
  }, [state.memberId, state.disciplines, registerAdvanceHandler]);

  // Load details for already-selected disciplines on mount (persistence)
  useEffect(() => {
    for (const enrollment of state.disciplines) {
      if (!disciplineData[enrollment.disciplineId]) {
        fetchDisciplineDetails(enrollment.disciplineId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold text-neutral-900">Disciplines & Schedule</h2>
          <p className="mt-1 text-sm text-neutral-500">Loading available disciplines...</p>
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold text-neutral-900">Disciplines & Schedule</h2>
        </header>
        <div className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm text-danger-fg">
          <p>{fetchError}</p>
        </div>
      </div>
    );
  }

  if (allDisciplines.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold text-neutral-900">Disciplines & Schedule</h2>
        </header>
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <p className="text-sm text-neutral-500">No active disciplines available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Disciplines & Schedule</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Select one or more disciplines and configure schedules for each.
        </p>
      </header>

      {/* Discipline selection cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {allDisciplines.map((disc, idx) => {
          const selected = state.disciplines.some((d) => d.disciplineId === disc.id);
          return (
            <button
              key={disc.id}
              type="button"
              id={`${baseId}-disc-${idx}`}
              aria-pressed={selected}
              onClick={() => toggleDiscipline(disc)}
              className={cn(
                'group relative flex min-h-[120px] w-full flex-col items-start gap-3 rounded-lg border p-5 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
                selected
                  ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600'
                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-elevation-2',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md',
                  selected ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-500',
                )}
              >
                <DisciplineIcon name={disc.name} />
              </div>
              <div>
                <h3
                  className={cn(
                    'text-base font-semibold',
                    selected ? 'text-primary-700' : 'text-neutral-900',
                  )}
                >
                  {disc.name}
                </h3>
              </div>
            </button>
          );
        })}
      </div>

      {validationResult.errors.disciplines && (
        <p className="text-sm text-danger" role="alert">
          {validationResult.errors.disciplines}
        </p>
      )}

      {/* Conflict warning */}
      {conflicts.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Schedule conflict detected</p>
            {conflicts.map((c, i) => (
              <p key={i}>{c}</p>
            ))}
          </div>
        </div>
      )}

      {/* Extra sessions info */}
      {totalSessions > 2 && (
        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-bg px-4 py-3 text-sm text-info-fg">
          <InfoIcon size={16} className="mt-0.5 shrink-0" />
          <p>
            {totalSessions} sessions per week selected. More than 2 sessions may incur additional
            fees.
          </p>
        </div>
      )}

      {/* Enrollment details for each selected discipline */}
      {state.disciplines.map((enrollment) => {
        const data = disciplineData[enrollment.disciplineId];
        const isTaekwondo =
          enrollment.disciplineName.toLowerCase() === 'taekwondo';

        const instructorOptions: SelectOption[] = (data?.instructors ?? []).map(
          (inst) => ({
            value: inst.id,
            label: inst.fullNameLatin + (inst.fullNameArabic ? ` / ${inst.fullNameArabic}` : ''),
          }),
        );

        return (
          <section
            key={enrollment.id}
            className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5"
          >
            <h3 className="text-base font-semibold text-neutral-900">
              {enrollment.disciplineName}
            </h3>

            {data?.loading && (
              <div className="flex flex-col gap-3">
                <Skeleton variant="text" lines={2} />
              </div>
            )}

            {data?.error && (
              <p className="text-sm text-danger" role="alert">
                {data.error}
              </p>
            )}

            {data && !data.loading && !data.error && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Select
                    label="Instructor"
                    placeholder="Select instructor (optional)"
                    options={instructorOptions}
                    value={enrollment.instructorId}
                    onChange={(v) =>
                      updateEnrollment(enrollment.disciplineId, { instructorId: v })
                    }
                  />
                  {isTaekwondo && (
                    <Select
                      label="Belt rank"
                      placeholder="Select belt rank"
                      options={BELT_RANKS}
                      value={enrollment.beltRank}
                      onChange={(v) =>
                        updateEnrollment(enrollment.disciplineId, { beltRank: v })
                      }
                    />
                  )}
                </div>

                {/* Weekly schedule grid */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    Weekly Schedule
                  </h4>
                  {data.timeSlots.length === 0 ? (
                    <p className="text-sm text-neutral-500">No available time slots.</p>
                  ) : (
                    <ScheduleGrid
                      timeSlots={data.timeSlots}
                      selectedSchedules={enrollment.schedules}
                      onToggle={(slot) =>
                        toggleSchedule(enrollment.disciplineId, slot)
                      }
                    />
                  )}
                  {validationResult.errors[`schedule-${enrollment.disciplineId}`] && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {validationResult.errors[`schedule-${enrollment.disciplineId}`]}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ──────── Schedule Grid ──────── */

interface ScheduleGridProps {
  timeSlots: TimeSlot[];
  selectedSchedules: ScheduleSelection[];
  onToggle: (slot: TimeSlot) => void;
}

function ScheduleGrid({ timeSlots, selectedSchedules, onToggle }: ScheduleGridProps) {
  // Group time slots by time range, then by day
  const uniqueTimes = useMemo(() => {
    const set = new Map<string, { startTime: string; endTime: string }>();
    for (const slot of timeSlots) {
      const key = `${slot.startTime}-${slot.endTime}`;
      if (!set.has(key)) {
        set.set(key, { startTime: slot.startTime, endTime: slot.endTime });
      }
    }
    return Array.from(set.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }, [timeSlots]);

  const slotMap = useMemo(() => {
    const map = new Map<string, TimeSlot>();
    for (const slot of timeSlots) {
      const key = `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
      map.set(key, slot);
    }
    return map;
  }, [timeSlots]);

  const selectedIds = useMemo(
    () => new Set(selectedSchedules.map((s) => s.timeSlotId)),
    [selectedSchedules],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-24 border-b border-neutral-200 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Time
            </th>
            {DAY_INDICES.map((dayIdx, i) => (
              <th
                key={dayIdx}
                className="border-b border-neutral-200 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                {DAY_NAMES[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueTimes.map((time) => (
            <tr key={`${time.startTime}-${time.endTime}`}>
              <td className="border-b border-neutral-100 py-2 pr-2 text-xs text-neutral-600">
                {time.startTime} - {time.endTime}
              </td>
              {DAY_INDICES.map((dayIdx) => {
                const key = `${dayIdx}-${time.startTime}-${time.endTime}`;
                const slot = slotMap.get(key);
                if (!slot) {
                  return (
                    <td
                      key={dayIdx}
                      className="border-b border-neutral-100 p-1 text-center"
                    >
                      <div className="mx-auto h-8 w-full rounded bg-neutral-50" />
                    </td>
                  );
                }
                const isSelected = selectedIds.has(slot.id);
                return (
                  <td
                    key={dayIdx}
                    className="border-b border-neutral-100 p-1 text-center"
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onToggle(slot)}
                      className={cn(
                        'mx-auto flex h-8 w-full items-center justify-center rounded text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
                        isSelected
                          ? 'bg-primary-500 text-white shadow-elevation-1'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-primary-100 hover:text-primary-700',
                      )}
                    >
                      {isSelected ? 'Selected' : 'Open'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────── Discipline Icon ──────── */

function DisciplineIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('taekwondo') || lower.includes('martial')) {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="5" r="2" />
        <path d="M10 21V13l-4-3 2-4h8l2 4-4 3v8" />
      </svg>
    );
  }
  if (lower.includes('swim')) {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 18c2-1 4 1 6 0s4-1 6 0 4 1 6 0" />
        <path d="M2 22c2-1 4 1 6 0s4-1 6 0 4 1 6 0" />
        <circle cx="9" cy="7" r="2" />
        <path d="M12 11l-3-2-3 3" />
        <path d="M9 9l5 3" />
      </svg>
    );
  }
  if (lower.includes('equest') || lower.includes('horse')) {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 5l-1 2h-3l-2 3-3-1-4 4v4l3 1 2-2h3l3-3v-3l2-3z" />
        <path d="M5 19l2 2" />
        <path d="M19 5l2-2" />
      </svg>
    );
  }
  // Default sport icon
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" />
      <path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10" />
      <path d="M2 12h20" />
    </svg>
  );
}
