import { useMemo, useState } from 'react';
import { cn } from '../../../lib/cn';
import { ClockIcon, UsersIcon, EditIcon, TrashIcon } from '../../../components/ui/Icon';
import { CapacityBadge } from './CapacityBadge';
import type { TimeSlot } from '../sessionsApi';

/* ──────────────────── Constants ──────────────────── */

const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_START = 6;  // 06:00
const HOUR_END = 22;   // 22:00
const TOTAL_HOURS = HOUR_END - HOUR_START;

/** Discipline color palette — cycles through 8 distinct colors */
const DISCIPLINE_COLORS = [
  { bg: 'bg-primary-50', border: 'border-primary-200', text: 'text-primary-700', accent: 'bg-primary-500' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-500' },
  { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', accent: 'bg-pink-500' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', accent: 'bg-teal-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-500' },
];

/* ──────────────────── Utilities ──────────────────── */

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display} ${suffix}`;
}

function getDisciplineColor(
  disciplineId: string,
  colorMap: Map<string, number>,
): (typeof DISCIPLINE_COLORS)[number] {
  if (!colorMap.has(disciplineId)) {
    colorMap.set(disciplineId, colorMap.size % DISCIPLINE_COLORS.length);
  }
  return DISCIPLINE_COLORS[colorMap.get(disciplineId)!];
}

/* ──────────────────── Types ──────────────────── */

interface WeeklyGridProps {
  timeSlots: TimeSlot[];
  onSlotClick: (slot: TimeSlot) => void;
  onEditSlot: (slot: TimeSlot) => void;
  onDeleteSlot: (slot: TimeSlot) => void;
  selectedDay: number;
  onDayChange: (day: number) => void;
}

/* ──────────────────── Session Block ──────────────────── */

interface SessionBlockProps {
  slot: TimeSlot;
  color: (typeof DISCIPLINE_COLORS)[number];
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  style: React.CSSProperties;
}

function SessionBlock({ slot, color, onClick, onEdit, onDelete, style }: SessionBlockProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${slot.discipline.name}, ${slot.startTime} to ${slot.endTime}, ${slot.currentEnrollment} of ${slot.maxCapacity} enrolled`}
      className={cn(
        'group absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md border transition-shadow',
        'hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
        color.bg,
        color.border,
      )}
      style={style}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Color accent bar */}
      <div className={cn('h-1 w-full', color.accent)} />

      <div className="px-2 py-1.5">
        {/* Discipline name */}
        <p className={cn('truncate text-xs font-semibold leading-tight', color.text)}>
          {slot.discipline.name}
        </p>

        {/* Time */}
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
          <ClockIcon size={10} />
          {slot.startTime} - {slot.endTime}
        </p>

        {/* Coach */}
        {slot.coach && (
          <p className="mt-0.5 truncate text-[10px] text-neutral-500">
            {slot.coach.fullNameLatin}
          </p>
        )}

        {/* Enrollment */}
        <div className="mt-1 flex items-center gap-1">
          <UsersIcon size={10} className="text-neutral-400" />
          <CapacityBadge
            current={slot.currentEnrollment}
            max={slot.maxCapacity}
            className="!text-[10px] !px-1.5 !py-0"
          />
        </div>
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="absolute right-1 top-2 flex gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex h-5 w-5 items-center justify-center rounded bg-white/80 text-neutral-500 shadow-sm transition-colors hover:bg-white hover:text-primary-600"
            aria-label={`Edit ${slot.discipline.name}`}
          >
            <EditIcon size={10} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-5 w-5 items-center justify-center rounded bg-white/80 text-neutral-500 shadow-sm transition-colors hover:bg-white hover:text-danger-fg"
            aria-label={`Delete ${slot.discipline.name}`}
          >
            <TrashIcon size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── Desktop Grid (7-column) ──────────────────── */

function DesktopGrid({
  timeSlots,
  colorMap,
  onSlotClick,
  onEditSlot,
  onDeleteSlot,
}: Omit<WeeklyGridProps, 'selectedDay' | 'onDayChange'> & { colorMap: Map<string, number> }) {
  const today = new Date().getDay();

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map = new Map<number, TimeSlot[]>();
    for (let d = 0; d < 7; d++) map.set(d, []);
    for (const slot of timeSlots) {
      map.get(slot.dayOfWeek)?.push(slot);
    }
    return map;
  }, [timeSlots]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-neutral-200">
          <div className="border-r border-neutral-100" />
          {DAY_LABELS_SHORT.map((label, i) => (
            <div
              key={i}
              className={cn(
                'py-2.5 text-center text-xs font-semibold uppercase tracking-wide',
                i === today
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-500',
                i < 6 && 'border-r border-neutral-100',
              )}
            >
              {label}
              {i === today && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary-500" />
              )}
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Time labels */}
          <div className="border-r border-neutral-100">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="relative flex h-16 items-start justify-end pr-2 text-[10px] text-neutral-400"
              >
                <span className="-translate-y-1.5">{formatHour(HOUR_START + i)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {Array.from({ length: 7 }, (_, dayIndex) => {
            const slots = slotsByDay.get(dayIndex) ?? [];
            return (
              <div
                key={dayIndex}
                className={cn(
                  'relative',
                  dayIndex === today && 'bg-primary-50/30',
                  dayIndex < 6 && 'border-r border-neutral-100',
                )}
              >
                {/* Hour grid lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    className="h-16 border-b border-neutral-100"
                  />
                ))}

                {/* Session blocks */}
                {slots.map((slot) => {
                  const startMin = timeToMinutes(slot.startTime);
                  const endMin = timeToMinutes(slot.endTime);
                  const gridStartMin = HOUR_START * 60;
                  const gridTotalMin = TOTAL_HOURS * 60;

                  const topPct = ((startMin - gridStartMin) / gridTotalMin) * 100;
                  const heightPct = ((endMin - startMin) / gridTotalMin) * 100;

                  if (topPct < 0 || topPct >= 100) return null;

                  const color = getDisciplineColor(slot.disciplineId, colorMap);

                  return (
                    <SessionBlock
                      key={slot.id}
                      slot={slot}
                      color={color}
                      onClick={() => onSlotClick(slot)}
                      onEdit={() => onEditSlot(slot)}
                      onDelete={() => onDeleteSlot(slot)}
                      style={{
                        top: `${topPct}%`,
                        height: `${Math.max(heightPct, 3)}%`,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Mobile Single-Day View ──────────────────── */

function MobileDayView({
  timeSlots,
  selectedDay,
  colorMap,
  onSlotClick,
  onEditSlot,
  onDeleteSlot,
}: {
  timeSlots: TimeSlot[];
  selectedDay: number;
  colorMap: Map<string, number>;
  onSlotClick: (slot: TimeSlot) => void;
  onEditSlot: (slot: TimeSlot) => void;
  onDeleteSlot: (slot: TimeSlot) => void;
}) {
  const daySlots = useMemo(
    () =>
      timeSlots
        .filter((s) => s.dayOfWeek === selectedDay)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [timeSlots, selectedDay],
  );

  if (daySlots.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-neutral-400">
        No sessions on {DAY_LABELS_FULL[selectedDay]}.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {daySlots.map((slot) => {
        const color = getDisciplineColor(slot.disciplineId, colorMap);
        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSlotClick(slot)}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-shadow',
              'hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              color.bg,
              color.border,
            )}
          >
            {/* Color stripe */}
            <div className={cn('mt-0.5 h-10 w-1 rounded-full', color.accent)} />

            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold', color.text)}>
                {slot.discipline.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                <ClockIcon size={12} />
                {slot.startTime} - {slot.endTime}
              </p>
              {slot.coach && (
                <p className="mt-0.5 text-xs text-neutral-500">
                  {slot.coach.fullNameLatin}
                </p>
              )}
              {slot.room && (
                <p className="mt-0.5 text-xs text-neutral-400">
                  {slot.room}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <CapacityBadge current={slot.currentEnrollment} max={slot.maxCapacity} />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSlot(slot);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-white hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  aria-label={`Edit ${slot.discipline.name}`}
                >
                  <EditIcon size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSlot(slot);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-white hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  aria-label={`Delete ${slot.discipline.name}`}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────── Main Component ──────────────────── */

export function WeeklyGrid({
  timeSlots,
  onSlotClick,
  onEditSlot,
  onDeleteSlot,
  selectedDay,
  onDayChange,
}: WeeklyGridProps) {
  // Build a stable color map for disciplines
  const colorMap = useMemo(() => {
    const map = new Map<string, number>();
    const uniqueIds = [...new Set(timeSlots.map((s) => s.disciplineId))];
    uniqueIds.forEach((id, i) => map.set(id, i % DISCIPLINE_COLORS.length));
    return map;
  }, [timeSlots]);

  return (
    <div>
      {/* Desktop: hidden below md */}
      <div className="hidden md:block">
        <DesktopGrid
          timeSlots={timeSlots}
          colorMap={colorMap}
          onSlotClick={onSlotClick}
          onEditSlot={onEditSlot}
          onDeleteSlot={onDeleteSlot}
        />
      </div>

      {/* Mobile: visible below md */}
      <div className="md:hidden">
        {/* Day picker tabs */}
        <div
          className="mb-4 flex overflow-x-auto border-b border-neutral-200"
          role="tablist"
          aria-label="Day of week"
        >
          {DAY_LABELS_SHORT.map((label, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === selectedDay}
              aria-controls={`day-panel-${i}`}
              onClick={() => onDayChange(i)}
              className={cn(
                'shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
                i === selectedDay
                  ? 'border-b-2 border-primary-500 text-primary-700'
                  : 'text-neutral-400 hover:text-neutral-600',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          id={`day-panel-${selectedDay}`}
          role="tabpanel"
          aria-label={DAY_LABELS_FULL[selectedDay]}
        >
          <MobileDayView
            timeSlots={timeSlots}
            selectedDay={selectedDay}
            colorMap={colorMap}
            onSlotClick={onSlotClick}
            onEditSlot={onEditSlot}
            onDeleteSlot={onDeleteSlot}
          />
        </div>
      </div>
    </div>
  );
}
