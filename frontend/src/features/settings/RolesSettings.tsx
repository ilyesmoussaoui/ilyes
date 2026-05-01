import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Modal, ConfirmModal } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { Skeleton } from '../../components/ui/Skeleton';
import { PlusIcon, EditIcon, TrashIcon, CheckIcon } from '../../components/ui/Icon';
import { Icon } from '../../components/ui';
import {
  fetchRoles,
  fetchRole,
  fetchPermissions,
  createRole,
  updateRole,
  deleteRole,
  type RoleSummary,
  type RoleDetail,
  type PermissionItem,
} from './settingsApi';
import { groupPermissions, resourceLabel, type PermissionGroup } from '../../lib/permissions';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';

interface RoleFormState {
  name: string;
  description: string;
  permissionKeys: Set<string>; // "resource:action" strings
}

const EMPTY_FORM: RoleFormState = {
  name: '',
  description: '',
  permissionKeys: new Set(),
};

const CANONICAL_ACTIONS = ['view', 'create', 'edit', 'delete'];

const ROLE_NAME_REGEX = /^[a-z][a-z0-9_ ]*$/i;

function validateRoleName(
  name: string,
  roles: RoleSummary[],
  editingRoleId: string | null,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Role name is required';
  if (trimmed.length > 100) return 'Role name must be 100 characters or fewer';
  if (!ROLE_NAME_REGEX.test(trimmed)) {
    return 'Must start with a letter. Only letters, numbers, spaces and underscores allowed.';
  }
  const normalized = trimmed.toLowerCase();
  const duplicate = roles.find(
    (r) => r.name.toLowerCase() === normalized && r.id !== editingRoleId,
  );
  if (duplicate) return 'A role with this name already exists';
  return null;
}

export function RolesSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [, setAllPermissions] = useState<PermissionItem[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDetail | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingRole, setLoadingRole] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<RoleSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = useMemo(
    () => editingRole?.name.toLowerCase() === 'admin',
    [editingRole],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, permsData] = await Promise.all([fetchRoles(), fetchPermissions()]);
      setRoles(rolesData.roles);
      setAllPermissions(permsData.permissions);
      setPermissionGroups(groupPermissions(permsData.permissions));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load roles';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = async (role: RoleSummary) => {
    setFormErrors({});
    setLoadingRole(true);
    setModalOpen(true);
    try {
      const data = await fetchRole(role.id);
      setEditingRole(data.role);
      setForm({
        name: data.role.name,
        description: data.role.description ?? '',
        permissionKeys: new Set(data.role.permissions),
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load role';
      toast.show({ type: 'error', title: 'Error', description: message });
      setModalOpen(false);
    } finally {
      setLoadingRole(false);
    }
  };

  const togglePermission = (permKey: string) => {
    if (isAdmin) return;
    setForm((prev) => {
      const next = new Set(prev.permissionKeys);
      if (next.has(permKey)) {
        next.delete(permKey);
      } else {
        next.add(permKey);
      }
      return { ...prev, permissionKeys: next };
    });
  };

  const toggleResourceAll = (group: PermissionGroup) => {
    if (isAdmin) return;
    const groupKeys = group.permissions.map((p) => `${p.resource}:${p.action}`);
    setForm((prev) => {
      const next = new Set(prev.permissionKeys);
      const allChecked = groupKeys.every((key) => next.has(key));
      if (allChecked) {
        for (const key of groupKeys) next.delete(key);
      } else {
        for (const key of groupKeys) next.add(key);
      }
      return { ...prev, permissionKeys: next };
    });
  };

  const handleNameChange = (value: string) => {
    setForm((p) => ({ ...p, name: value }));
    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!editingRole?.isSystem) {
      const nameError = validateRoleName(form.name, roles, editingRole?.id ?? null);
      if (nameError) errors.name = nameError;
    }
    if (form.description.trim().length > 500) {
      errors.description = 'Description must be 500 characters or fewer';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      if (editingRole) {
        const body = {
          ...(editingRole.isSystem ? {} : { name: form.name.trim() }),
          description: form.description.trim() || undefined,
          permissions: Array.from(form.permissionKeys),
        };
        await updateRole(editingRole.id, body);
        toast.show({ type: 'success', title: 'Role updated' });
      } else {
        await createRole({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          permissions: Array.from(form.permissionKeys),
        });
        toast.show({ type: 'success', title: 'Role created' });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'DUPLICATE_NAME') {
          setFormErrors({ name: err.message });
          return;
        }
        if (err.code === 'ADMIN_ROLE' || err.code === 'SYSTEM_ROLE') {
          toast.show({ type: 'error', title: 'Protected role', description: err.message });
          return;
        }
        toast.show({ type: 'error', title: 'Error', description: err.message });
      } else {
        toast.show({ type: 'error', title: 'Error', description: 'Operation failed' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRole(deleteTarget.id);
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.show({ type: 'success', title: 'Role deleted' });
    } catch (err) {
      if (err instanceof ApiError) {
        const title =
          err.code === 'ROLE_IN_USE'
            ? 'Role is in use'
            : err.code === 'SYSTEM_ROLE'
              ? 'Protected role'
              : 'Failed to delete role';
        toast.show({ type: 'error', title, description: err.message });
      } else {
        toast.show({ type: 'error', title: 'Error', description: 'Failed to delete role' });
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" lines={1} width="180px" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-800">Failed to load roles</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Roles & Permissions</h2>
          <p className="text-sm text-neutral-600">
            Define roles and control what each role can access.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} iconLeft={<PlusIcon size={16} />}>
          Create Role
        </Button>
      </div>

      {/* Role Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} padding="md" className="relative">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-neutral-900 capitalize">
                    {role.name}
                  </h3>
                  {role.isSystem && (
                    <span className="inline-flex items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      System
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{role.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(role)}
                  aria-label={`Edit ${role.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
                >
                  <EditIcon size={15} />
                </button>
                {!role.isSystem && role.userCount === 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(role)}
                    aria-label={`Delete ${role.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-danger-bg hover:text-danger"
                  >
                    <TrashIcon size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1" title="Users assigned to this role">
                <Icon name="users" size={13} />
                {role.userCount} user{role.userCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1" title="Permissions granted to this role">
                <Icon name="lock" size={13} />
                {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {roles.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Icon name="lock" size={28} className="text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-800">No roles yet</p>
            <p className="text-xs text-neutral-500">Create a role to define permissions.</p>
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create Role'}
        size="lg"
      >
        {loadingRole ? (
          <div className="space-y-4 py-4">
            <Skeleton variant="text" lines={2} />
            <Skeleton variant="card" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Role Name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  error={formErrors.name}
                  placeholder="e.g. Trainer"
                  disabled={editingRole?.isSystem}
                  helperText={
                    editingRole?.isSystem
                      ? 'System role names cannot be changed.'
                      : 'Letters, numbers, spaces and underscores only.'
                  }
                  maxLength={100}
                />
                <Input
                  label="Description"
                  value={form.description}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, description: e.target.value }));
                    if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: '' }));
                  }}
                  placeholder="Brief description"
                  error={formErrors.description}
                  maxLength={500}
                />
              </div>

              {/* Permission Matrix */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-neutral-700">Permissions</h4>
                {isAdmin && (
                  <p className="mb-3 text-xs text-neutral-500 italic">
                    The Admin role always has full access. Permissions cannot be modified.
                  </p>
                )}
                <div className="max-h-[400px] overflow-auto rounded-lg border border-neutral-200">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-neutral-50">
                      <tr>
                        <th className="border-b border-neutral-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Resource
                        </th>
                        {CANONICAL_ACTIONS.map((action) => (
                          <th
                            key={action}
                            className="border-b border-neutral-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500"
                          >
                            {action}
                          </th>
                        ))}
                        <th className="border-b border-neutral-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          All
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissionGroups.map((group, gi) => {
                        const groupKeys = group.permissions.map((p) => `${p.resource}:${p.action}`);
                        const allChecked =
                          isAdmin || groupKeys.every((key) => form.permissionKeys.has(key));
                        return (
                          <tr
                            key={group.resource}
                            className={cn(
                              'border-b border-neutral-100',
                              gi % 2 === 1 && 'bg-neutral-50/40',
                            )}
                          >
                            <td className="px-4 py-2.5 font-medium text-neutral-800">
                              {resourceLabel(group.resource)}
                            </td>
                            {CANONICAL_ACTIONS.map((action) => {
                              const perm = group.permissions.find((p) => p.action === action);
                              if (!perm) {
                                return (
                                  <td key={action} className="px-3 py-2.5 text-center">
                                    <span className="text-neutral-300">&mdash;</span>
                                  </td>
                                );
                              }
                              const permKey = `${group.resource}:${perm.action}`;
                              const checked = isAdmin || form.permissionKeys.has(permKey);
                              return (
                                <td key={action} className="px-3 py-2.5 text-center">
                                  <label className="inline-flex cursor-pointer items-center">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePermission(permKey)}
                                      disabled={isAdmin}
                                      className="sr-only"
                                      aria-label={`${resourceLabel(group.resource)} ${action}`}
                                    />
                                    <span
                                      className={cn(
                                        'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                                        checked
                                          ? 'border-primary-500 bg-primary-500 text-white'
                                          : 'border-neutral-300 bg-white hover:border-neutral-400',
                                        isAdmin && 'cursor-not-allowed opacity-60',
                                      )}
                                    >
                                      {checked && <CheckIcon size={12} />}
                                    </span>
                                  </label>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5 text-center">
                              <label className="inline-flex cursor-pointer items-center">
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onChange={() => toggleResourceAll(group)}
                                  disabled={isAdmin}
                                  className="sr-only"
                                  aria-label={`Select all ${resourceLabel(group.resource)} permissions`}
                                />
                                <span
                                  className={cn(
                                    'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                                    allChecked
                                      ? 'border-primary-500 bg-primary-500 text-white'
                                      : 'border-neutral-300 bg-white hover:border-neutral-400',
                                    isAdmin && 'cursor-not-allowed opacity-60',
                                  )}
                                >
                                  {allChecked && <CheckIcon size={12} />}
                                </span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                      {permissionGroups.length === 0 && (
                        <tr>
                          <td colSpan={CANONICAL_ACTIONS.length + 2} className="px-4 py-8 text-center text-neutral-500">
                            No permissions available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} loading={submitting}>
                {editingRole ? 'Save Changes' : 'Create Role'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Role"
        message={
          deleteTarget
            ? `Delete the "${deleteTarget.name}" role? No users are assigned to it, but this action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
      />
    </div>
  );
}
