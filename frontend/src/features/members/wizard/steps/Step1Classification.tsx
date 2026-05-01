import { useEffect, useId, useMemo } from 'react';
import { cn } from '../../../../lib/cn';
import { Select, useToast } from '../../../../components/ui';
import { useWizard } from '../useWizard';
import type { MemberType, StaffRole } from '../../api/membersApi';
import { createMember } from '../../api/membersApi';
import type { SelectOption } from '../../../../types/ui';

interface TypeCardProps {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  icon: JSX.Element;
  id: string;
}

function TypeCard({ title, description, selected, onClick, icon, id }: TypeCardProps) {
  return (
    <button
      type="button"
      id={id}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[180px] w-full flex-col items-start gap-3 rounded-lg border p-5 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
        selected
          ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600'
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-elevation-2',
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-md',
          selected ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-500',
        )}
      >
        {icon}
      </div>
      <div>
        <h3
          className={cn(
            'text-base font-semibold',
            selected ? 'text-primary-700' : 'text-neutral-900',
          )}
        >
          {title}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
    </button>
  );
}

const STAFF_ROLE_OPTIONS: SelectOption[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'coach', label: 'Coach' },
  { value: 'accountant', label: 'Accountant' },
];

export function Step1Classification() {
  const {
    state,
    update,
    registerValidator,
    registerAdvanceHandler,
    notifyStepEvaluation,
  } = useWizard();
  const baseId = useId();
  const { show } = useToast();

  const validationResult = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!state.type) {
      errors.type = 'Please select a member type';
    }
    if (state.type === 'staff' && !state.staffRole) {
      errors.staffRole = 'Please select a staff role';
    }
    const ok = Object.keys(errors).length === 0;
    return {
      ok,
      errors,
      firstInvalidFieldId: ok
        ? undefined
        : errors.type
          ? `${baseId}-athlete`
          : `${baseId}-staff-role`,
    };
  }, [state.type, state.staffRole, baseId]);

  useEffect(() => {
    notifyStepEvaluation('classification', validationResult.ok);
  }, [validationResult.ok, notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('classification', () => validationResult);
  }, [validationResult, registerValidator]);

  useEffect(() => {
    return registerAdvanceHandler('classification', async () => {
      if (!state.type) return false;
      if (state.memberId) {
        return true;
      }
      // staffRole is UX-only in Part 3; persist with user-account linkage in a later part
      try {
        const created = await createMember({ type: state.type });
        update({ memberId: created.id });
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create member. Please try again.';
        show({ type: 'error', title: 'Could not start registration', description: message });
        return false;
      }
    });
  }, [state.type, state.memberId, update, registerAdvanceHandler, show]);

  const typeCards: Array<{
    value: MemberType;
    title: string;
    description: string;
    icon: JSX.Element;
  }> = [
    {
      value: 'athlete',
      title: 'Athlete',
      description: 'Members training on disciplines and schedules.',
      icon: <DumbbellIcon />,
    },
    {
      value: 'staff',
      title: 'Staff',
      description: 'Managers, receptionists, coaches, accountants.',
      icon: <UserTieIcon />,
    },
    {
      value: 'external',
      title: 'External',
      description: 'Visitors or consultants with limited access.',
      icon: <UserPlusIcon />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Member classification</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choose the type of member you are registering. You can change this later.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {typeCards.map((card) => (
          <TypeCard
            key={card.value}
            id={`${baseId}-${card.value}`}
            title={card.title}
            description={card.description}
            selected={state.type === card.value}
            icon={card.icon}
            onClick={() =>
              update({
                type: card.value,
                staffRole: card.value === 'staff' ? state.staffRole : null,
              })
            }
          />
        ))}
      </div>

      {state.type && validationResult.errors.type && (
        <p className="text-sm text-danger" role="alert">
          {validationResult.errors.type}
        </p>
      )}

      {state.type === 'staff' && (
        <div className="max-w-sm">
          <Select
            id={`${baseId}-staff-role`}
            label="Staff role"
            placeholder="Select staff role"
            value={state.staffRole}
            options={STAFF_ROLE_OPTIONS}
            onChange={(value) => update({ staffRole: value as StaffRole })}
            error={validationResult.errors.staffRole ?? null}
          />
        </div>
      )}
    </div>
  );
}

function DumbbellIcon() {
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
      <path d="M6 4v16" />
      <path d="M18 4v16" />
      <path d="M2 8v8" />
      <path d="M22 8v8" />
      <path d="M6 12h12" />
    </svg>
  );
}

function UserTieIcon() {
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
      <circle cx="12" cy="7" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M12 11v4" />
    </svg>
  );
}

function UserPlusIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
