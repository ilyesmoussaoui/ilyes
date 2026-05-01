import { useState } from 'react';
import { Card, Button, Modal, ConfirmModal } from '../../../../components/ui';
import { Badge } from '../../../../components/ui/Badge';
import { DatePicker } from '../../../../components/ui/DatePicker';
import {
  TrashIcon,
  PlusIcon,
  AlertIcon,
  UploadIcon,
} from '../../../../components/ui/Icon';
import type { MemberProfile, DocumentInfo } from '../../profile/profileTypes';
import { deleteDocument, updateDocument, uploadDocumentFile, addDocument } from '../editApi';
import { useToast } from '../../../../components/ui/Toast';
import { formatDate } from '../../profile/profileUtils';

interface DocumentsTabProps {
  profile: MemberProfile;
  onSaved: () => void;
}

const DOC_STATUS_VARIANT: Record<
  DocumentInfo['status'],
  'active' | 'expired' | 'pending'
> = {
  valid: 'active',
  expired: 'expired',
  pending: 'pending',
};

const DOC_STATUS_LABEL: Record<DocumentInfo['status'], string> = {
  valid: 'Valid',
  expired: 'Expired',
  pending: 'Pending',
};

function daysSinceExpiry(expiryDate: string): number {
  const diff = Date.now() - new Date(expiryDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface EditDocModalState {
  doc: DocumentInfo;
  issueDate: string | null;
  expiryDate: string | null;
  saving: boolean;
  error: string | null;
}

export function DocumentsTab({ profile, onSaved }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>(profile.documents);
  const [editModal, setEditModal] = useState<EditDocModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newDocType, setNewDocType] = useState('');
  const [newDocIssue, setNewDocIssue] = useState<string | null>(null);
  const [newDocExpiry, setNewDocExpiry] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(profile.id, deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      showToast({ type: 'success', title: 'Document deleted' });
      onSaved();
    } catch {
      showToast({ type: 'error', title: 'Failed to delete document' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setEditModal((prev) =>
      prev ? { ...prev, saving: true, error: null } : null,
    );
    try {
      const res = await updateDocument(profile.id, editModal.doc.id, {
        issueDate: editModal.issueDate,
        expiryDate: editModal.expiryDate,
      });
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === editModal.doc.id
            ? {
                ...d,
                issueDate: editModal.issueDate,
                expiryDate: editModal.expiryDate,
                status: res.document.status as DocumentInfo['status'],
              }
            : d,
        ),
      );
      showToast({ type: 'success', title: 'Document updated' });
      setEditModal(null);
      onSaved();
    } catch (err) {
      setEditModal((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              error:
                err instanceof Error ? err.message : 'Failed to update document',
            }
          : null,
      );
    }
  };

  const handleFileUpload = async (doc: DocumentInfo, file: File) => {
    setUploadingId(doc.id);
    try {
      await uploadDocumentFile(profile.id, file, doc.id);
      showToast({ type: 'success', title: 'File uploaded' });
      onSaved();
    } catch {
      showToast({ type: 'error', title: 'Failed to upload file' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleAddDocument = async () => {
    if (!newDocType.trim()) {
      setAddError('Document type is required');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await addDocument(profile.id, {
        type: newDocType.trim(),
        issueDate: newDocIssue,
        expiryDate: newDocExpiry,
      });
      const newDoc: DocumentInfo = {
        id: res.document.id,
        type: res.document.type,
        status: res.document.status as DocumentInfo['status'],
        issueDate: newDocIssue,
        expiryDate: newDocExpiry,
        notes: null,
      };
      setDocuments((prev) => [...prev, newDoc]);
      showToast({ type: 'success', title: 'Document added' });
      setAddModalOpen(false);
      setNewDocType('');
      setNewDocIssue(null);
      setNewDocExpiry(null);
      onSaved();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : 'Failed to add document',
      );
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          {documents.length === 0
            ? 'No documents'
            : `${documents.length} document${documents.length === 1 ? '' : 's'}`}
        </p>
        <Button
          variant="secondary"
          iconLeft={<PlusIcon size={14} />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">No documents</p>
            <p className="text-xs text-neutral-500">
              Add a document to track member&apos;s identification or
              certifications.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map((doc) => {
            const isExpired =
              doc.status === 'expired' ||
              (doc.expiryDate && new Date(doc.expiryDate) < new Date());
            const daysExpired =
              doc.expiryDate && isExpired
                ? daysSinceExpiry(doc.expiryDate)
                : null;

            return (
              <div
                key={doc.id}
                className={`rounded-lg border bg-white p-4 shadow-elevation-1 ${
                  isExpired ? 'border-danger/30' : 'border-neutral-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900">
                        {doc.type}
                      </span>
                      <Badge
                        variant={DOC_STATUS_VARIANT[doc.status]}
                        label={DOC_STATUS_LABEL[doc.status]}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-neutral-500">
                      <span>Issue: {formatDate(doc.issueDate)}</span>
                      <span
                        className={
                          isExpired ? 'font-medium text-danger-fg' : ''
                        }
                      >
                        Expiry: {formatDate(doc.expiryDate)}
                      </span>
                    </div>
                    {daysExpired !== null && daysExpired > 0 && (
                      <p className="mt-1 text-xs font-medium text-danger-fg">
                        Expired {daysExpired} day{daysExpired === 1 ? '' : 's'}{' '}
                        ago
                      </p>
                    )}
                    {doc.notes && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {doc.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* File upload */}
                    <label
                      className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 px-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 ${
                        uploadingId === doc.id
                          ? 'pointer-events-none opacity-60'
                          : ''
                      }`}
                      title="Upload file"
                    >
                      <UploadIcon size={13} />
                      <span className="hidden sm:inline">Upload</span>
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={uploadingId === doc.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleFileUpload(doc, file);
                          e.target.value = '';
                        }}
                        aria-label={`Upload file for ${doc.type}`}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setEditModal({
                          doc,
                          issueDate: doc.issueDate,
                          expiryDate: doc.expiryDate,
                          saving: false,
                          error: null,
                        })
                      }
                      aria-label={`Edit ${doc.type}`}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(doc)}
                      aria-label={`Delete ${doc.type}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 transition-colors hover:border-danger/30 hover:bg-danger-bg hover:text-danger-fg"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit document modal */}
      {editModal && (
        <Modal
          open
          onClose={() => setEditModal(null)}
          title={`Edit: ${editModal.doc.type}`}
          size="sm"
        >
          <div className="flex flex-col gap-4">
            <DatePicker
              label="Issue date"
              value={editModal.issueDate}
              setValue={(v) =>
                setEditModal((prev) =>
                  prev ? { ...prev, issueDate: v } : null,
                )
              }
              minYear={2000}
            />
            <DatePicker
              label="Expiry date"
              value={editModal.expiryDate}
              setValue={(v) =>
                setEditModal((prev) =>
                  prev ? { ...prev, expiryDate: v } : null,
                )
              }
              minYear={2000}
            />
            <p className="text-xs text-neutral-400 italic">
              Notes support coming soon.
            </p>
            {editModal.error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg"
              >
                <AlertIcon size={14} />
                {editModal.error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setEditModal(null)}
                disabled={editModal.saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleEditSave()}
                loading={editModal.saving}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmModal
          open
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
          title="Delete document"
          message={`Are you sure you want to delete the "${deleteTarget.type}" document? This cannot be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          destructive
        />
      )}

      {/* Add document modal */}
      <Modal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setNewDocType('');
          setNewDocIssue(null);
          setNewDocExpiry(null);
          setAddError(null);
        }}
        title="Add Document"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">
              Document type <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={newDocType}
              onChange={(e) => setNewDocType(e.target.value)}
              placeholder="e.g. National ID, Medical Certificate..."
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <DatePicker
            label="Issue date"
            value={newDocIssue}
            setValue={setNewDocIssue}
            minYear={2000}
          />
          <DatePicker
            label="Expiry date"
            value={newDocExpiry}
            setValue={setNewDocExpiry}
            minYear={2000}
          />
          {addError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg"
            >
              <AlertIcon size={14} />
              {addError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setAddModalOpen(false)}
              disabled={addSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleAddDocument()}
              loading={addSaving}
            >
              Add Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
