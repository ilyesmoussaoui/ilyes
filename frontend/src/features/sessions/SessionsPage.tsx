import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ConfirmModal, Skeleton } from '../../components/ui';
import { useToast } from '../../components/ui';
import {
  ChevronRightIcon,
  PlusIcon,
  CalendarIcon,
  InboxIcon,
} from '../../components/ui/Icon';
import { getTimeSlots, deleteTimeSlot } from './sessionsApi';
import type { TimeSlot } from './sessionsApi';
import { WeeklyGrid } from './components/WeeklyGrid';
import { SessionFormModal } from './components/SessionFormModal';
import { RosterPanel } from './components/RosterPanel';
import { cn } from '../../lib/cn';

const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function GridSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton variant="text" width="50px" />
          <div className="flex flex-1 gap-2">
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} variant="card" className="!p-3 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SessionsPage() {
  const today = new Date().getDay();
  const toast = useToast();
  const queryClient = useQueryClient();

  // View state
  const [selectedDay, setSelectedDay] = useState(today);
  const [filterDay, setFilterDay] = useState<number | null>(null);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null);
  const [rosterSlotId, setRosterSlotId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeSlot | null>(null);

  // Fetch all time slots
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['sessions', 'time-slots'],
    queryFn: () => getTimeSlots(),
    refetchInterval: 60_000,
  });

  const timeSlots = data?.timeSlots ?? [];

  // Filtered slots for display
  const displaySlots = useMemo(() => {
    if (filterDay === null) return timeSlots;
    return timeSlots.filter((s) => s.dayOfWeek === filterDay);
  }, [timeSlots, filterDay]);

  // Session count per day (for the day filter tabs)
  const countByDay = useMemo(() => {
    const counts = new Map<number, number>();
    for (let d = 0; d < 7; d++) counts.set(d, 0);
    for (const slot of timeSlots) {
      counts.set(slot.dayOfWeek, (counts.get(slot.dayOfWeek) ?? 0) + 1);
    }
    return counts;
  }, [timeSlots]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimeSlot(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.show({ type: 'success', title: 'Session deleted' });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.show({ type: 'error', title: 'Failed to delete session' });
    },
  });

  // Handlers
  const handleSlotClick = (slot: TimeSlot) => {
    setRosterSlotId(slot.id);
  };

  const handleEditSlot = (slot: TimeSlot) => {
    setEditSlot(slot);
    setFormOpen(true);
  };

  const handleDeleteSlot = (slot: TimeSlot) => {
    setDeleteTarget(slot);
  };

  const handleCreateNew = () => {
    setEditSlot(null);
    setFormOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Home
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="font-semibold text-neutral-700">Sessions</li>
        </ol>
      </nav>

      {/* Header */}
      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-neutral-900">
              Sessions & Scheduling
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Manage weekly time slots, view rosters, and track attendance.
            </p>
          </div>
          <Button
            variant="primary"
            iconLeft={<PlusIcon size={16} />}
            onClick={handleCreateNew}
          >
            Add Session
          </Button>
        </div>
      </Card>

      {/* Day Filter Tabs */}
      <div className="mt-6">
        <div
          className="flex overflow-x-auto"
          role="tablist"
          aria-label="Filter by day of week"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterDay === null}
            onClick={() => setFilterDay(null)}
            className={cn(
              'shrink-0 rounded-t-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
              filterDay === null
                ? 'border-b-2 border-primary-500 bg-white text-primary-700'
                : 'text-neutral-400 hover:text-neutral-600',
            )}
          >
            <CalendarIcon size={13} className="mr-1.5 inline-block" />
            All Days
            <span className="ml-1.5 text-[10px] tabular-nums">({timeSlots.length})</span>
          </button>

          {DAY_LABELS_SHORT.map((label, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={filterDay === i}
              onClick={() => setFilterDay(i)}
              className={cn(
                'shrink-0 rounded-t-md px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
                filterDay === i
                  ? 'border-b-2 border-primary-500 bg-white text-primary-700'
                  : i === today && filterDay === null
                    ? 'text-primary-500'
                    : 'text-neutral-400 hover:text-neutral-600',
              )}
            >
              {label}
              <span className="ml-1 text-[10px] tabular-nums">
                ({countByDay.get(i) ?? 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Area */}
      <Card className="mt-0 !rounded-tl-none border-t-0">
        {isLoading && <GridSkeleton />}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="rounded-full bg-danger-bg p-3 text-danger-fg">
              <CalendarIcon size={24} />
            </div>
            <p className="text-sm font-medium text-neutral-700">
              Failed to load sessions
            </p>
            <p className="text-xs text-neutral-500">
              Could not fetch schedule data. Please try again.
            </p>
            <Button
              variant="secondary"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && timeSlots.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <InboxIcon size={28} />
            </div>
            <p className="text-sm font-semibold text-neutral-700">
              No sessions scheduled
            </p>
            <p className="text-xs text-neutral-500">
              Create your first session to get started with scheduling.
            </p>
            <Button
              variant="primary"
              iconLeft={<PlusIcon size={16} />}
              onClick={handleCreateNew}
            >
              Add Session
            </Button>
          </div>
        )}

        {!isLoading && !isError && displaySlots.length === 0 && timeSlots.length > 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <p className="text-sm text-neutral-500">
              No sessions on this day.
            </p>
            <Button
              variant="ghost"
              onClick={() => setFilterDay(null)}
            >
              Show all days
            </Button>
          </div>
        )}

        {!isLoading && !isError && displaySlots.length > 0 && (
          <WeeklyGrid
            timeSlots={displaySlots}
            onSlotClick={handleSlotClick}
            onEditSlot={handleEditSlot}
            onDeleteSlot={handleDeleteSlot}
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <SessionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditSlot(null);
        }}
        editSlot={editSlot}
      />

      {/* Roster Panel */}
      <RosterPanel
        slotId={rosterSlotId}
        onClose={() => setRosterSlotId(null)}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        title="Delete Session"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.discipline.name}" on ${DAY_LABELS_SHORT[deleteTarget.dayOfWeek]} at ${deleteTarget.startTime}? This will remove all enrollments for this time slot.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
