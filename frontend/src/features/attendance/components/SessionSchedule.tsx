import { useQuery } from '@tanstack/react-query';
import { Card, Skeleton } from '../../../components/ui';
import { CalendarIcon, UsersIcon } from '../../../components/ui/Icon';
import { getTodaySessions } from '../attendanceApi';
import type { SessionInfo } from '../attendanceApi';

function isSessionActive(session: SessionInfo): boolean {
  const now = new Date();
  const [startH, startM] = session.startTime.split(':').map(Number);
  const [endH, endM] = session.endTime.split(':').map(Number);

  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return nowMin >= startMin && nowMin <= endMin;
}

function SessionCard({ session }: { session: SessionInfo }) {
  const active = isSessionActive(session);

  return (
    <div
      className={`rounded-md border px-3 py-2.5 transition-colors ${
        active
          ? 'border-primary-300 bg-primary-50'
          : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <CalendarIcon
          size={14}
          className={active ? 'text-primary-500' : 'text-neutral-400'}
        />
        <span className="text-xs font-semibold text-neutral-700">
          {session.startTime} - {session.endTime}
        </span>
        {active && (
          <span className="ml-auto inline-flex items-center rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
            Live
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-neutral-900">
        {session.discipline.name}
      </p>
      <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
        <UsersIcon size={12} />
        <span>{session.enrolledCount} enrolled</span>
      </div>
    </div>
  );
}

export function SessionSchedule() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance', 'sessions', 'today'],
    queryFn: getTodaySessions,
    refetchInterval: 60_000,
  });

  return (
    <section aria-labelledby="sessions-heading">
      <h3
        id="sessions-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500"
      >
        Today's Sessions
      </h3>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} variant="card" className="!p-3" />
          ))}
        </div>
      ) : isError ? (
        <Card padding="sm">
          <p className="text-xs text-danger-fg">Failed to load sessions</p>
        </Card>
      ) : !data || data.sessions.length === 0 ? (
        <Card padding="sm">
          <p className="text-xs text-neutral-500">No sessions scheduled today</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {data.sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </section>
  );
}
