import { useState } from 'react';
import { Card, Button, ConfirmModal } from '../../../../components/ui';
import { Badge } from '../../../../components/ui/Badge';
import {
  TrashIcon,
  PlusIcon,
  AlertIcon,
} from '../../../../components/ui/Icon';
import type { MemberProfile, DisciplineEnrollment } from '../../profile/profileTypes';
import { deleteEnrollment } from '../editApi';
import { useToast } from '../../../../components/ui/Toast';
import { formatDate } from '../../profile/profileUtils';
import { AddDisciplineModal } from './AddDisciplineModal';

interface DisciplinesTabProps {
  profile: MemberProfile;
  onSaved: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function statusToVariant(
  status: string,
): 'active' | 'suspended' | 'inactive' {
  switch (status.toLowerCase()) {
    case 'active':
      return 'active';
    case 'suspended':
      return 'suspended';
    default:
      return 'inactive';
  }
}

function EnrollmentCard({
  enrollment,
  memberId,
  onDeleted,
}: {
  enrollment: DisciplineEnrollment;
  memberId: string;
  onDeleted: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEnrollment(memberId, enrollment.id);
      onDeleted(enrollment.id);
      showToast({ type: 'success', title: 'Enrollment removed' });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete enrollment',
      );
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-neutral-900">
              {enrollment.disciplineName}
            </h3>
            {enrollment.beltRank && (
              <p className="mt-0.5 text-xs text-neutral-500">
                Belt rank:{' '}
                <span className="font-medium text-neutral-700">
                  {enrollment.beltRank}
                </span>
              </p>
            )}
            {enrollment.instructorName && (
              <p className="mt-0.5 text-xs text-neutral-500">
                Instructor:{' '}
                <span className="font-medium text-neutral-700">
                  {enrollment.instructorName}
                </span>
              </p>
            )}
            <p className="mt-0.5 text-xs text-neutral-400">
              Enrolled: {formatDate(enrollment.enrollmentDate)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={statusToVariant(enrollment.status)}
              label={enrollment.status}
            />
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label={`Remove ${enrollment.disciplineName} enrollment`}
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-danger-bg hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            >
              <TrashIcon size={15} />
            </button>
          </div>
        </div>

        {enrollment.schedules.length > 0 && (
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Schedule
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {enrollment.schedules.map((s) => (
                <li
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700"
                >
                  <span>{DAY_NAMES[s.dayOfWeek]}</span>
                  <span>
                    {s.startTime}–{s.endTime}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {deleteError && (
          <div
            role="alert"
            className="mt-2 flex items-center gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-xs text-danger-fg"
          >
            <AlertIcon size={12} />
            {deleteError}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Remove enrollment"
        message={`Are you sure you want to remove the ${enrollment.disciplineName} enrollment? This action cannot be undone.`}
        confirmLabel="Remove"
        loading={deleting}
        destructive
      />
    </>
  );
}

export function DisciplinesTab({ profile, onSaved }: DisciplinesTabProps) {
  const [disciplines, setDisciplines] = useState<DisciplineEnrollment[]>(
    profile.disciplines,
  );
  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleDeleted = (id: string) => {
    setDisciplines((prev) => prev.filter((d) => d.id !== id));
    onSaved();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          {disciplines.length === 0
            ? 'No disciplines enrolled'
            : `${disciplines.length} discipline${disciplines.length === 1 ? '' : 's'} enrolled`}
        </p>
        <Button
          variant="secondary"
          iconLeft={<PlusIcon size={14} />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Discipline
        </Button>
      </div>

      {disciplines.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">
              No disciplines enrolled
            </p>
            <p className="text-xs text-neutral-500">
              Click "Add Discipline" to enroll this member in a new discipline.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {disciplines.map((d) => (
            <li key={d.id}>
              <EnrollmentCard
                enrollment={d}
                memberId={profile.id}
                onDeleted={handleDeleted}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Add discipline modal */}
      <AddDisciplineModal
        open={addModalOpen}
        memberId={profile.id}
        existingDisciplineIds={disciplines.map((d) => d.disciplineId)}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => {
          setAddModalOpen(false);
          onSaved();
        }}
      />
    </div>
  );
}
