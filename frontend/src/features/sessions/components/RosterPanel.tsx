import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Skeleton, Button } from '../../../components/ui';
import { useToast } from '../../../components/ui';
import {
  UsersIcon,
  ClockIcon,
  CalendarIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
} from '../../../components/ui/Icon';
import { getTimeSlotRoster, toggleAttendance } from '../sessionsApi';
import type { RosterMember } from '../sessionsApi';
import { cn } from '../../../lib/cn';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface RosterPanelProps {
  slotId: string | null;
  onClose: () => void;
}

function CapacityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const level: 'normal' | 'warning' | 'danger' =
    pct >= 100 ? 'danger' : pct >= 90 ? 'warning' : 'normal';

  const barColor = {
    normal: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }[level];

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Capacity</span>
        <span className="tabular-nums font-medium">
          {current}/{max} enrolled
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${current} of ${max} enrolled`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {level === 'warning' && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-warning-fg">
          <AlertIcon size={12} />
          <span>Near Capacity</span>
        </div>
      )}
      {level === 'danger' && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger-fg">
          <AlertIcon size={12} />
          <span>Full</span>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  slotId,
}: {
  member: RosterMember;
  slotId: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isPresent = member.attendanceToday !== null;

  const mutation = useMutation({
    mutationFn: () =>
      toggleAttendance(slotId, {
        memberId: member.memberId,
        present: !isPresent,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', 'roster', slotId] });
      toast.show({
        type: 'success',
        title: isPresent ? 'Attendance removed' : 'Attendance recorded',
        description: `${member.member.firstNameLatin ?? ''} ${member.member.lastNameLatin ?? ''}`.trim(),
      });
    },
    onError: () => {
      toast.show({
        type: 'error',
        title: 'Failed to update attendance',
      });
    },
  });

  const initials =
    ((member.member.firstNameLatin ?? '').charAt(0) || '') +
    ((member.member.lastNameLatin ?? '').charAt(0) || '');

  return (
    <li className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-neutral-50">
      {member.member.photoPath ? (
        <img
          src={member.member.photoPath}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800">
          {member.member.firstNameLatin ?? ''} {member.member.lastNameLatin ?? ''}
        </p>
        {isPresent && member.attendanceToday && (
          <p className="text-xs text-success-fg">
            Checked in at{' '}
            {new Date(member.attendanceToday.checkInTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
      <Button
        variant={isPresent ? 'primary' : 'ghost'}
        size="default"
        onClick={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={mutation.isPending}
        className={cn(
          '!h-8 !px-2.5',
          isPresent
            ? '!bg-success !text-white hover:!bg-success-fg'
            : 'border border-neutral-200',
        )}
        aria-label={
          isPresent
            ? `Remove attendance for ${member.member.firstNameLatin}`
            : `Mark ${member.member.firstNameLatin} as present`
        }
      >
        {isPresent ? <CheckIcon size={14} /> : <XIcon size={14} />}
        <span className="text-xs">{isPresent ? 'Present' : 'Absent'}</span>
      </Button>
    </li>
  );
}

function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3">
          <Skeleton variant="avatar" width="36px" height="36px" />
          <div className="flex-1">
            <Skeleton variant="text" width="60%" />
          </div>
          <Skeleton variant="text" width="64px" />
        </div>
      ))}
    </div>
  );
}

export function RosterPanel({ slotId, onClose }: RosterPanelProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sessions', 'roster', slotId],
    queryFn: () => getTimeSlotRoster(slotId!),
    enabled: slotId !== null,
  });

  return (
    <Modal
      open={slotId !== null}
      onClose={onClose}
      title={data ? data.timeSlot.discipline.name : 'Session Roster'}
      description={
        data
          ? `${DAY_NAMES[data.timeSlot.dayOfWeek]} ${data.timeSlot.startTime} - ${data.timeSlot.endTime}`
          : undefined
      }
      size="md"
    >
      {isLoading && <RosterSkeleton />}

      {isError && (
        <div className="rounded-md border border-danger/20 bg-danger-bg px-4 py-6 text-center text-sm text-danger-fg">
          Failed to load roster. Close and try again.
        </div>
      )}

      {data && (
        <div>
          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <CalendarIcon size={13} />
              {DAY_NAMES[data.timeSlot.dayOfWeek]}
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon size={13} />
              {data.timeSlot.startTime} - {data.timeSlot.endTime}
            </span>
            {data.timeSlot.coach && (
              <span className="flex items-center gap-1">
                <UsersIcon size={13} />
                {data.timeSlot.coach.fullNameLatin}
              </span>
            )}
          </div>

          {/* Capacity Bar */}
          <CapacityBar
            current={data.enrollment.current}
            max={data.enrollment.max}
          />

          {/* Member List */}
          <div className="mt-4 border-t border-neutral-100 pt-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Enrolled Members ({data.roster.length})
            </h4>

            {data.roster.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-400">
                No members enrolled in this session yet.
              </div>
            ) : (
              <ul
                className="max-h-[360px] overflow-y-auto"
                role="list"
                aria-label="Enrolled members"
              >
                {data.roster.map((member) => (
                  <MemberRow
                    key={member.scheduleId}
                    member={member}
                    slotId={slotId!}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
