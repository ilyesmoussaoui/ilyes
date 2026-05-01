import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, Modal, ConfirmModal, Table, Badge } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { Skeleton } from '../../components/ui/Skeleton';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon } from '../../components/ui/Icon';
import { Icon } from '../../components/ui';
import {
  fetchUsers,
  fetchRoles,
  createUser,
  updateUser,
  deleteUser,
  type SettingsUser,
  type RoleSummary,
  type CreateUserPayload,
  type UpdateUserPayload,
} from './settingsApi';
import { ApiError } from '../../lib/api';
import type { TableColumn } from '../../types/ui';

interface UserFormState {
  fullNameLatin: string;
  fullNameArabic: string;
  email: string;
  password: string;
  confirmPassword: string;
  roleId: string;
}

const EMPTY_FORM: UserFormState = {
  fullNameLatin: '',
  fullNameArabic: '',
  email: '',
  password: '',
  confirmPassword: '',
  roleId: '',
};

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/\d/.test(password)) return 'Password must contain a number';
  return null;
}

export function UsersSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SettingsUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Confirm modals
  const [toggleUser, setToggleUser] = useState<SettingsUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingsUser | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, rolesData] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(usersData.users);
      setRoles(rolesData.roles);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load users';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.fullNameLatin.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roleName.toLowerCase().includes(q),
    );
  }, [users, search]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (user: SettingsUser) => {
    setEditingUser(user);
    setForm({
      fullNameLatin: user.fullNameLatin,
      fullNameArabic: user.fullNameArabic ?? '',
      email: user.email,
      password: '',
      confirmPassword: '',
      roleId: user.roleId,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.fullNameLatin.trim()) errors.fullNameLatin = 'Full name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    if (!form.roleId) errors.roleId = 'Role is required';

    // Password validation
    if (!editingUser) {
      // Creating: password required
      if (!form.password) {
        errors.password = 'Password is required';
      } else {
        const pwErr = validatePassword(form.password);
        if (pwErr) errors.password = pwErr;
      }
      if (form.password !== form.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else if (form.password) {
      // Editing: password optional but must be valid if provided
      const pwErr = validatePassword(form.password);
      if (pwErr) errors.password = pwErr;
      if (form.password !== form.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      if (editingUser) {
        const body: UpdateUserPayload = {
          fullNameLatin: form.fullNameLatin.trim(),
          fullNameArabic: form.fullNameArabic.trim() || null,
          email: form.email.trim(),
          roleId: form.roleId,
        };
        if (form.password) body.password = form.password;
        const data = await updateUser(editingUser.id, body);
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data.user : u)));
        toast.show({ type: 'success', title: 'User updated' });
      } else {
        const body: CreateUserPayload = {
          fullNameLatin: form.fullNameLatin.trim(),
          fullNameArabic: form.fullNameArabic.trim() || undefined,
          email: form.email.trim(),
          password: form.password,
          roleId: form.roleId,
        };
        const data = await createUser(body);
        setUsers((prev) => [...prev, data.user]);
        toast.show({ type: 'success', title: 'User created' });
      }
      setModalOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Operation failed';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleUser) return;
    // Check: cannot deactivate the last admin
    if (toggleUser.isActive) {
      const activeAdmins = users.filter(
        (u) => u.isActive && u.roleName.toLowerCase() === 'admin',
      );
      if (
        activeAdmins.length <= 1 &&
        toggleUser.roleName.toLowerCase() === 'admin'
      ) {
        toast.show({
          type: 'error',
          title: 'Cannot deactivate',
          description: 'You cannot deactivate the last admin user.',
        });
        setToggleUser(null);
        return;
      }
    }
    setConfirming(true);
    try {
      const data = await updateUser(toggleUser.id, {
        isActive: !toggleUser.isActive,
      });
      setUsers((prev) => prev.map((u) => (u.id === toggleUser.id ? data.user : u)));
      toast.show({
        type: 'success',
        title: data.user.isActive ? 'User activated' : 'User deactivated',
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Operation failed';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setConfirming(false);
      setToggleUser(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setConfirming(true);
    try {
      await deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast.show({ type: 'success', title: 'User deleted' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Operation failed';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setConfirming(false);
      setDeleteTarget(null);
    }
  };

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  const columns: TableColumn<SettingsUser>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        accessor: (row) => (
          <div>
            <p className="font-medium text-neutral-900">{row.fullNameLatin}</p>
            {row.fullNameArabic && (
              <p className="text-xs text-neutral-500 font-arabic" dir="rtl">
                {row.fullNameArabic}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        sortable: true,
        accessor: (row) => <span className="text-neutral-700">{row.email}</span>,
      },
      {
        key: 'role',
        header: 'Role',
        sortable: true,
        accessor: (row) => (
          <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
            {row.roleName}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (row) => (
          <Badge variant={row.isActive ? 'active' : 'inactive'} />
        ),
      },
      {
        key: 'lastLogin',
        header: 'Last Login',
        sortable: true,
        accessor: (row) => (
          <span className="text-neutral-600">
            {row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : 'Never'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        accessor: (row) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
              aria-label={`Edit ${row.fullNameLatin}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
            >
              <EditIcon size={15} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setToggleUser(row);
              }}
              aria-label={row.isActive ? `Deactivate ${row.fullNameLatin}` : `Activate ${row.fullNameLatin}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-warning-fg"
            >
              <Icon name={row.isActive ? 'toggle-right' : 'toggle-left'} size={15} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
              aria-label={`Delete ${row.fullNameLatin}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-danger-bg hover:text-danger"
            >
              <TrashIcon size={15} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" lines={1} width="200px" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-800">Failed to load users</p>
          <p className="text-xs text-neutral-500">{error}</p>
          <Button variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
            <SearchIcon size={16} />
          </span>
          <input
            type="search"
            placeholder="Search users..."
            aria-label="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <Button variant="primary" onClick={openCreate} iconLeft={<PlusIcon size={16} />}>
          Add User
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={filteredUsers}
        getRowId={(row) => row.id}
        pageSize={10}
        emptyTitle="No users found"
        emptyMessage={search ? 'Try adjusting your search.' : 'Create your first user to get started.'}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Edit User' : 'Add User'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full Name (Latin)"
              value={form.fullNameLatin}
              onChange={(e) => setForm((p) => ({ ...p, fullNameLatin: e.target.value }))}
              error={formErrors.fullNameLatin}
              placeholder="John Doe"
            />
            <Input
              label="Full Name (Arabic)"
              value={form.fullNameArabic}
              onChange={(e) => setForm((p) => ({ ...p, fullNameArabic: e.target.value }))}
              direction="rtl"
              placeholder="Optional"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            error={formErrors.email}
            placeholder="user@example.com"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={editingUser ? 'New Password (leave empty to keep)' : 'Password'}
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              error={formErrors.password}
              placeholder={editingUser ? 'Leave empty to keep current' : 'Min 8 characters'}
            />
            <Input
              label="Confirm Password"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              error={formErrors.confirmPassword}
              placeholder="Re-enter password"
            />
          </div>
          <Select
            label="Role"
            options={roleOptions}
            value={form.roleId}
            onChange={(val) => setForm((p) => ({ ...p, roleId: val }))}
            error={formErrors.roleId}
            placeholder="Select a role..."
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {editingUser ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </Modal>

      {/* Toggle Active Confirmation */}
      <ConfirmModal
        open={!!toggleUser}
        onClose={() => setToggleUser(null)}
        onConfirm={handleToggleActive}
        title={toggleUser?.isActive ? 'Deactivate User' : 'Activate User'}
        message={
          toggleUser?.isActive
            ? `Are you sure you want to deactivate ${toggleUser.fullNameLatin}? They will no longer be able to sign in.`
            : `Are you sure you want to activate ${toggleUser?.fullNameLatin ?? 'this user'}?`
        }
        confirmLabel={toggleUser?.isActive ? 'Deactivate' : 'Activate'}
        destructive={!!toggleUser?.isActive}
        loading={confirming}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteTarget?.fullNameLatin ?? 'this user'}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={confirming}
      />
    </div>
  );
}
