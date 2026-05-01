import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmModal } from '../../../components/ui/Modal';
import { CopyIcon, TrashIcon } from '../../../components/ui/Icon';
import { usePermission } from '../../../hooks/usePermission';
import { useToast } from '../../../hooks/useToast';
import { ApiError } from '../../../lib/api';
import { deleteMember } from './editApi';
import type { MemberProfile } from '../profile/profileTypes';

interface EditHeaderProps {
  profile: MemberProfile;
}

function getInitials(profile: MemberProfile): string {
  const first = profile.firstNameLatin ?? profile.firstNameArabic ?? '';
  const last = profile.lastNameLatin ?? profile.lastNameArabic ?? '';
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?';
}

function getDisplayName(profile: MemberProfile): string {
  const latin = [profile.firstNameLatin, profile.lastNameLatin]
    .filter(Boolean)
    .join(' ');
  const arabic = [profile.firstNameArabic, profile.lastNameArabic]
    .filter(Boolean)
    .join(' ');
  return latin || arabic || 'Unknown Member';
}

function statusToVariant(
  status: string,
): 'active' | 'inactive' | 'suspended' | 'expired' | 'pending' {
  switch (status.toLowerCase()) {
    case 'active':
      return 'active';
    case 'inactive':
      return 'inactive';
    case 'suspended':
      return 'suspended';
    case 'expired':
      return 'expired';
    default:
      return 'pending';
  }
}

const TYPE_COLORS: Record<MemberProfile['type'], string> = {
  athlete: 'bg-primary-100 text-primary-700 border border-primary-200',
  staff: 'bg-info-bg text-info-fg border border-info/20',
  external: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
};

const TYPE_LABELS: Record<MemberProfile['type'], string> = {
  athlete: 'Athlete',
  staff: 'Staff',
  external: 'External',
};

export function EditHeader({ profile }: EditHeaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const canDelete = usePermission('members', 'delete');

  const [copied, setCopied] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const photoUrl = profile.photoPath
    ? `/api/v1/files/photos/${profile.photoPath}`
    : null;
  const displayName = getDisplayName(profile);

  const handleCopyId = useCallback(() => {
    void navigator.clipboard.writeText(profile.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [profile.id]);

  const handleConfirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteMember(profile.id);
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      showToast({
        type: 'success',
        title: 'Member deleted',
        description: `${displayName} has been removed.`,
      });
      setDeleteModalOpen(false);
      navigate('/members');
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : 'Could not delete the member. Please try again.';
      showToast({ type: 'error', title: 'Delete failed', description });
      setDeleting(false);
    }
  }, [profile.id, displayName, navigate, queryClient, showToast]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
      {/* Thumbnail */}
      <div className="shrink-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${displayName} photo`}
            className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-elevation-1"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-sm font-bold text-neutral-500 shadow-elevation-1"
          >
            {getInitials(profile)}
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-bold text-neutral-900 sm:text-lg">
            {displayName}
          </h1>
          <Badge
            variant={statusToVariant(profile.status)}
            label={
              profile.status.charAt(0).toUpperCase() + profile.status.slice(1)
            }
          />
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[profile.type]}`}
          >
            {TYPE_LABELS[profile.type]}
          </span>
        </div>

        {/* Member ID with copy button */}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-mono text-xs text-neutral-500">ID:</span>
          <span className="font-mono text-xs font-medium text-neutral-700">
            {profile.id}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={handleCopyId}
              aria-label="Copy member ID"
              className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <CopyIcon size={12} />
            </button>
            {copied && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white shadow-elevation-2"
              >
                Copied!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right-side actions */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary-500"
            aria-hidden
          />
          Editing
        </span>
        {canDelete && (
          <Button
            variant="danger"
            iconLeft={<TrashIcon size={14} />}
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete
          </Button>
        )}
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => (deleting ? undefined : setDeleteModalOpen(false))}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete member?"
        message={`This will permanently remove ${displayName} and all related records from active lists. This action cannot be undone.`}
        confirmLabel="Delete member"
        cancelLabel="Cancel"
        destructive
        loading={deleting}
      />
    </div>
  );
}
