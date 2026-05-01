import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Modal, ConfirmModal, Table, Badge } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { Skeleton } from '../../components/ui/Skeleton';
import { PlusIcon, EditIcon, TrashIcon } from '../../components/ui/Icon';
import { Icon } from '../../components/ui';
import {
  fetchDisciplines,
  createDiscipline,
  updateDiscipline,
  deleteDiscipline,
  type Discipline,
} from './settingsApi';
import { ApiError } from '../../lib/api';
import type { TableColumn } from '../../types/ui';

export function DisciplinesSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Discipline | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Discipline | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<Discipline | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDisciplines();
      setDisciplines(data.disciplines);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load disciplines';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingItem(null);
    setName('');
    setNameError(null);
    setModalOpen(true);
  };

  const openEdit = (item: Discipline) => {
    setEditingItem(item);
    setName(item.name);
    setNameError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError('Discipline name is required');
      return;
    }
    setSubmitting(true);
    try {
      if (editingItem) {
        const data = await updateDiscipline(editingItem.id, { name: name.trim() });
        setDisciplines((prev) =>
          prev.map((d) => (d.id === editingItem.id ? data.discipline : d)),
        );
        toast.show({ type: 'success', title: 'Discipline updated' });
      } else {
        const data = await createDiscipline({ name: name.trim() });
        setDisciplines((prev) => [...prev, data.discipline]);
        toast.show({ type: 'success', title: 'Discipline created' });
      }
      setModalOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Operation failed';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const data = await updateDiscipline(toggleTarget.id, { isActive: !toggleTarget.isActive });
      setDisciplines((prev) =>
        prev.map((d) => (d.id === toggleTarget.id ? data.discipline : d)),
      );
      toast.show({
        type: 'success',
        title: data.discipline.isActive ? 'Discipline activated' : 'Discipline deactivated',
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Operation failed';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setToggling(false);
      setToggleTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDiscipline(deleteTarget.id);
      setDisciplines((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.show({ type: 'success', title: 'Discipline deleted' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete discipline';
      toast.show({ type: 'error', title: 'Error', description: message });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const columns: TableColumn<Discipline>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        accessor: (row) => (
          <span className="font-medium text-neutral-900">{row.name}</span>
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
        key: 'members',
        header: 'Members',
        sortable: true,
        accessor: (row) => (
          <span className="text-neutral-600">{row.activeEnrollments ?? 0}</span>
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
              aria-label={`Edit ${row.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
            >
              <EditIcon size={15} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setToggleTarget(row);
              }}
              aria-label={row.isActive ? `Deactivate ${row.name}` : `Activate ${row.name}`}
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
              aria-label={`Delete ${row.name}`}
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
          <p className="text-sm font-semibold text-neutral-800">Failed to load disciplines</p>
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
          <h2 className="text-lg font-semibold text-neutral-900">Disciplines</h2>
          <p className="text-sm text-neutral-600">
            Manage sport disciplines available for member enrollment.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} iconLeft={<PlusIcon size={16} />}>
          Add Discipline
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={disciplines}
        getRowId={(row) => row.id}
        pageSize={10}
        emptyTitle="No disciplines"
        emptyMessage="Create your first discipline to get started."
      />

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Discipline' : 'Add Discipline'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Discipline Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            error={nameError}
            placeholder="e.g. Karate, Swimming, Fitness"
            autoFocus
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {editingItem ? 'Save' : 'Create'}
          </Button>
        </div>
      </Modal>

      {/* Toggle Active */}
      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.isActive ? 'Deactivate Discipline' : 'Activate Discipline'}
        message={
          toggleTarget?.isActive
            ? `Deactivate "${toggleTarget.name}"? New members won't be able to enroll in this discipline.`
            : `Activate "${toggleTarget?.name ?? ''}"? Members will be able to enroll again.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        destructive={!!toggleTarget?.isActive}
        loading={toggling}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Discipline"
        message={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"? This is only possible if there are no active enrollments.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
      />
    </div>
  );
}
