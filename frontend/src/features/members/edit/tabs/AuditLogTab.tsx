import { AuditLogSection } from '../../profile/sections/AuditLogSection';

interface AuditLogTabProps {
  memberId: string;
}

export function AuditLogTab({ memberId }: AuditLogTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Explicit read-only notice */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <p className="text-xs font-medium text-neutral-600">
          Audit log is read-only. Changes to member data are automatically
          recorded here.
        </p>
      </div>

      <AuditLogSection memberId={memberId} />
    </div>
  );
}
