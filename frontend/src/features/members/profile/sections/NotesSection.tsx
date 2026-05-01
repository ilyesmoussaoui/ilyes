import { useState } from 'react';
import { Card, Button, Modal, ConfirmModal } from '../../../../components/ui';
import { useToast } from '../../../../components/ui';
import type { NoteInfo } from '../profileTypes';
import { createNote, updateNote, deleteNote } from '../profileApi';
import { PlusIcon, TrashIcon, EditIcon } from '../../../../components/ui/Icon';
import { formatDateTime } from '../profileUtils';

interface NotesSectionProps {
  memberId: string;
  initialNotes: NoteInfo[];
}

function NoteCard({
  note,
  memberId,
  onUpdated,
  onDeleted,
}: {
  note: NoteInfo;
  memberId: string;
  onUpdated: (updated: NoteInfo) => void;
  onDeleted: (id: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const res = await updateNote(memberId, note.id, editContent.trim());
      onUpdated(res.note);
      showToast({ type: 'success', title: 'Note updated' });
      setEditOpen(false);
    } catch {
      showToast({ type: 'error', title: 'Failed to update note' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteNote(memberId, note.id);
      onDeleted(note.id);
      showToast({ type: 'success', title: 'Note deleted' });
    } catch {
      showToast({ type: 'error', title: 'Failed to delete note' });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-elevation-1">
        <p className="whitespace-pre-wrap text-sm text-neutral-800 leading-relaxed">{note.content}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-neutral-600">{note.creatorName}</p>
            <p className="text-xs text-neutral-400">{formatDateTime(note.createdAt)}</p>
            {note.updatedAt !== note.createdAt && (
              <p className="text-xs text-neutral-400">(edited {formatDateTime(note.updatedAt)})</p>
            )}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { setEditContent(note.content); setEditOpen(true); }}
              aria-label="Edit note"
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <EditIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete note"
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-danger-bg hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit note"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-note-content" className="text-sm font-medium text-neutral-700">
              Note content
            </label>
            <textarea
              id="edit-note-content"
              rows={5}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
              placeholder="Write your note here..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving} disabled={!editContent.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Delete note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        destructive
      />
    </>
  );
}

export function NotesSection({ memberId, initialNotes }: NotesSectionProps) {
  const [notes, setNotes] = useState<NoteInfo[]>(
    [...initialNotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await createNote(memberId, newContent.trim());
      setNotes((prev) => [res.note, ...prev]);
      showToast({ type: 'success', title: 'Note added' });
      setAddOpen(false);
      setNewContent('');
    } catch {
      showToast({ type: 'error', title: 'Failed to add note' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdated = (updated: NoteInfo) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDeleted = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <>
      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="sr-only">Notes</h2>

        <Card
          title="Notes"
          action={
            <Button
              variant="secondary"
              size="default"
              iconLeft={<PlusIcon size={15} />}
              onClick={() => setAddOpen(true)}
            >
              Add note
            </Button>
          }
        >
          {notes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm font-medium text-neutral-700">No notes yet</p>
              <p className="text-xs text-neutral-500">Add a note to track important information about this member.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li key={note.id}>
                  <NoteCard
                    note={note}
                    memberId={memberId}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Add note modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setNewContent(''); }}
        title="Add note"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="new-note-content" className="text-sm font-medium text-neutral-700">
              Note content
            </label>
            <textarea
              id="new-note-content"
              rows={5}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
              placeholder="Write your note here..."
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAddOpen(false); setNewContent(''); }} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleAdd()}
              loading={saving}
              disabled={!newContent.trim()}
            >
              Add note
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
