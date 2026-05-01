import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Badge, Card, EmptyState, ErrorState, Skeleton, Table } from '../../components/ui';
import { PlusIcon, ChevronRightIcon, XIcon } from '../../components/ui/Icon';
import { usePermission } from '../../hooks/usePermission';
import {
  listMembers,
  type MemberListItem,
  type MemberScope,
  type MemberStatus,
} from './api/membersApi';
import type { TableColumn } from '../../types/ui';

const SCOPE_KEYS: Record<MemberScope, string> = {
  unpaid: 'members.list.scopes.unpaid',
  renewal: 'members.list.scopes.renewal',
  expiring: 'members.list.scopes.expiring',
  docs: 'members.list.scopes.docs',
  inactive: 'members.list.scopes.inactive',
  absent: 'members.list.scopes.absent',
};

function isScope(v: string | null): v is MemberScope {
  return v !== null && v in SCOPE_KEYS;
}

const STATUS_TO_BADGE: Record<MemberStatus, 'active' | 'inactive' | 'suspended' | 'pending'> = {
  active: 'active',
  inactive: 'inactive',
  suspended: 'suspended',
  pending: 'pending',
};

function safeBadgeVariant(status: string): 'active' | 'inactive' | 'suspended' | 'pending' {
  return (STATUS_TO_BADGE as Record<string, 'active' | 'inactive' | 'suspended' | 'pending'>)[
    status
  ] ?? 'pending';
}

function useMemberColumns(): TableColumn<MemberListItem>[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        key: 'name',
        header: t('members.list.columns.name'),
        sortable: true,
        accessor: (row: MemberListItem) => {
          const full = [row.firstNameLatin, row.lastNameLatin].filter(Boolean).join(' ');
          return full || <span className="italic text-neutral-400">{t('members.list.noName')}</span>;
        },
      },
      {
        key: 'type',
        header: t('members.list.columns.type'),
        sortable: true,
        accessor: (row: MemberListItem) => (
          <span>{t(`members.type.${row.type}`, { defaultValue: row.type })}</span>
        ),
      },
      {
        key: 'status',
        header: t('members.list.columns.status'),
        accessor: (row: MemberListItem) => (
          <Badge variant={safeBadgeVariant(row.status)} />
        ),
      },
      {
        key: 'disciplines',
        header: t('members.list.columns.disciplines'),
        accessor: (row: MemberListItem) => {
          if (row.type !== 'athlete' || row.disciplines.length === 0) {
            return <span className="text-neutral-400">—</span>;
          }
          return (
            <span className="text-neutral-700">{row.disciplines.join(', ')}</span>
          );
        },
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        width: '80px',
        accessor: (row: MemberListItem) => (
          <Link
            to={`/members/${row.id}`}
            className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onClick={(e) => e.stopPropagation()}
          >
            {t('members.list.columns.view')}
          </Link>
        ),
      },
    ],
    [t],
  );
}

export function MembersPage() {
  const { t } = useTranslation();
  const columns = useMemberColumns();
  const navigate = useNavigate();
  const canCreate = usePermission('members', 'create');

  const [searchParams, setSearchParams] = useSearchParams();
  const rawScope = searchParams.get('scope');
  const scope: MemberScope | undefined = isScope(rawScope) ? rawScope : undefined;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['members', scope ?? 'all'],
    queryFn: () => listMembers({ pageSize: 200, scope }),
    staleTime: 30_000,
  });

  const members = data?.members ?? [];

  const clearScope = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('scope');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label={t('app.breadcrumb')} className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {t('app.home')}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="font-semibold text-neutral-700">{t('sidebar.menu.members')}</li>
        </ol>
      </nav>

      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-neutral-900">{t('members.list.title')}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {t('members.list.subtitle')}
              {data != null && (
                <span className="ml-1 text-neutral-400">{t('members.list.total', { count: data.total })}</span>
              )}
            </p>
          </div>
          {canCreate && (
            <Button
              variant="primary"
              iconLeft={<PlusIcon size={16} />}
              onClick={() => navigate('/members/add')}
            >
              {t('members.list.addMember')}
            </Button>
          )}
        </div>

        {scope && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">{t('members.list.filterBy')}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
              {t(SCOPE_KEYS[scope])}
              <button
                type="button"
                onClick={clearScope}
                aria-label={t('members.list.clearFilter')}
                className="flex h-4 w-4 items-center justify-center rounded-full text-primary-500 transition-colors hover:bg-primary-100 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <XIcon size={12} />
              </button>
            </span>
          </div>
        )}

        <div className="mt-6">
          {isLoading ? (
            <Skeleton variant="table" rows={6} columns={5} />
          ) : isError ? (
            <ErrorState
              title={t('members.list.failedToLoad')}
              error={error}
              onRetry={() => void refetch()}
              compact
            />
          ) : members.length === 0 ? (
            <EmptyState
              illustration="members"
              title={t('members.list.noMembersYet')}
              description={t('members.list.noMembersDescription')}
              actionLabel={canCreate ? t('members.list.addFirst') : undefined}
              onAction={canCreate ? () => navigate('/members/add') : undefined}
            />
          ) : (
            <Table<MemberListItem>
              columns={columns}
              data={members}
              getRowId={(row) => row.id}
              onRowClick={(row) => navigate(`/members/${row.id}`)}
              pageSize={50}
              emptyTitle={t('members.list.noMembersFound')}
              emptyMessage={t('members.list.tryDifferentFilters')}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
