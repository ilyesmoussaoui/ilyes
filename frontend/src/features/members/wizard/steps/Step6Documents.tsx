import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../../../lib/cn';
import { DatePicker } from '../../../../components/ui';
import { CheckIcon, AlertIcon } from '../../../../components/ui/Icon';
import { useWizard } from '../useWizard';
import type { DocumentEntry } from '../wizardTypes';
import { saveMemberDocuments, uploadDocument } from '../../api/membersApi';
import { computeAge } from '../../helpers/validators';

interface DocumentTypeConfig {
  type: string;
  label: string;
  visibleWhen: (ctx: { age: number | null; hasTaekwondo: boolean }) => boolean;
}

const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    type: 'id_card',
    label: 'ID Card',
    visibleWhen: () => true,
  },
  {
    type: 'medical_certificate',
    label: 'Medical Certificate',
    visibleWhen: () => true,
  },
  {
    type: 'birth_certificate',
    label: 'Birth Certificate',
    visibleWhen: () => true,
  },
  {
    type: 'insurance',
    label: 'Insurance',
    visibleWhen: () => true,
  },
  {
    type: 'parental_authorization',
    label: 'Parental Authorization',
    visibleWhen: ({ age }) => age !== null && age < 18,
  },
  {
    type: 'belt_certificate',
    label: 'Belt Certificate',
    visibleWhen: ({ hasTaekwondo }) => hasTaekwondo,
  },
];

let docIdCounter = 0;
function nextDocId(): string {
  docIdCounter += 1;
  return `doc-${Date.now()}-${docIdCounter}`;
}

export function Step6Documents() {
  const { state, update, registerValidator, registerAdvanceHandler, notifyStepEvaluation } =
    useWizard();
  const baseId = useId();

  const age = state.dateOfBirth ? computeAge(state.dateOfBirth) : null;
  const hasTaekwondo = state.disciplines.some(
    (d) => d.disciplineName.toLowerCase() === 'taekwondo',
  );

  const visibleTypes = useMemo(
    () =>
      DOCUMENT_TYPES.filter((dt) =>
        dt.visibleWhen({ age, hasTaekwondo }),
      ),
    [age, hasTaekwondo],
  );

  // Initialize documents list if empty or when visible types change
  useEffect(() => {
    const currentTypes = new Set(state.documents.map((d) => d.type));
    const visibleTypeKeys = new Set(visibleTypes.map((vt) => vt.type));
    const needsUpdate =
      visibleTypes.some((vt) => !currentTypes.has(vt.type)) ||
      state.documents.some((d) => !visibleTypeKeys.has(d.type));

    if (needsUpdate) {
      const docs: DocumentEntry[] = visibleTypes.map((vt) => {
        const existing = state.documents.find((d) => d.type === vt.type);
        return (
          existing ?? {
            id: nextDocId(),
            type: vt.type,
            label: vt.label,
            checked: false,
            filePath: null,
            pendingFile: null,
            issueDate: null,
            expiryDate: null,
          }
        );
      });
      update({ documents: docs });
    }
  }, [visibleTypes, state.documents, update]);

  const updateDoc = useCallback(
    (docType: string, patch: Partial<DocumentEntry>) => {
      update({
        documents: state.documents.map((d) =>
          d.type === docType ? { ...d, ...patch } : d,
        ),
      });
    },
    [state.documents, update],
  );

  // Validation
  const validationResult = useMemo(() => {
    const errors: Record<string, string> = {};
    state.documents.forEach((doc) => {
      if (doc.checked && !doc.filePath && !doc.pendingFile) {
        errors[`file-${doc.type}`] = `Please upload a file for ${doc.label}`;
      }
    });
    const ok = Object.keys(errors).length === 0;
    return {
      ok,
      errors,
      firstInvalidFieldId: ok ? undefined : `${baseId}-doc-0`,
    };
  }, [state.documents, baseId]);

  useEffect(() => {
    notifyStepEvaluation('documents', validationResult.ok);
  }, [validationResult.ok, notifyStepEvaluation]);

  useEffect(() => {
    return registerValidator('documents', () => validationResult);
  }, [validationResult, registerValidator]);

  useEffect(() => {
    return registerAdvanceHandler('documents', async () => {
      if (!state.memberId) return false;
      const checked = state.documents.filter((d) => d.checked);
      if (checked.length > 0) {
        const res = await saveMemberDocuments(state.memberId, {
          documents: checked.map((d) => ({
            type: d.type,
            label: d.label,
            issueDate: d.issueDate,
            expiryDate: d.expiryDate,
          })),
        });

        // Upload pending files using server-returned document UUIDs
        const updatedDocs = [...state.documents];
        const uploadPromises: Promise<void>[] = [];
        for (const serverDoc of res.documents) {
          const localDoc = checked.find((d) => d.type === serverDoc.type);
          if (localDoc?.pendingFile) {
            uploadPromises.push(
              uploadDocument(state.memberId!, localDoc.pendingFile, serverDoc.id).then(
                (uploadRes) => {
                  const idx = updatedDocs.findIndex((d) => d.type === serverDoc.type);
                  if (idx !== -1) {
                    updatedDocs[idx] = {
                      ...updatedDocs[idx],
                      filePath: uploadRes.filePath,
                      pendingFile: null,
                    };
                  }
                },
              ),
            );
          }
        }
        if (uploadPromises.length > 0) {
          await Promise.all(uploadPromises);
          update({ documents: updatedDocs });
        }
      }
      return true;
    });
  }, [state.memberId, state.documents, registerAdvanceHandler, update]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-neutral-900">Required Documents</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Check the documents you have and upload them. Unchecked documents can be added later.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {state.documents.map((doc, idx) => (
          <DocumentCard
            key={doc.type}
            doc={doc}
            idx={idx}
            baseId={baseId}
            error={validationResult.errors[`file-${doc.type}`] ?? null}
            onUpdate={(patch) => updateDoc(doc.type, patch)}
          />
        ))}
      </div>

      {state.documents.length === 0 && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <p className="text-sm text-neutral-500">No documents to display for this member type.</p>
        </div>
      )}
    </div>
  );
}

/* ──────── Document Card ──────── */

interface DocumentCardProps {
  doc: DocumentEntry;
  idx: number;
  baseId: string;
  error: string | null;
  onUpdate: (patch: Partial<DocumentEntry>) => void;
}

function DocumentCard({ doc, idx, baseId, error, onUpdate }: DocumentCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (file: File) => {
      setUploadError(null);
      // Store the file locally; actual upload happens during advance
      onUpdate({ pendingFile: file });
    },
    [onUpdate],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileChange(file);
      }
    },
    [handleFileChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div
      id={idx === 0 ? `${baseId}-doc-0` : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 transition-all',
        doc.checked
          ? 'border-primary-200 bg-white'
          : 'border-neutral-200 bg-neutral-50',
      )}
    >
      {/* Checkbox header */}
      <label className="flex cursor-pointer items-center gap-3">
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
            doc.checked
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-neutral-300 bg-white',
          )}
        >
          {doc.checked && <CheckIcon size={12} />}
        </span>
        <input
          type="checkbox"
          checked={doc.checked}
          onChange={(e) => onUpdate({ checked: e.target.checked })}
          className="sr-only"
          aria-label={`Include ${doc.label}`}
        />
        <span className="text-sm font-semibold text-neutral-900">{doc.label}</span>
      </label>

      {/* Content area - disabled visually when unchecked */}
      <div
        className={cn(
          'flex flex-col gap-3 transition-opacity',
          !doc.checked && 'pointer-events-none opacity-40',
        )}
      >
        {/* File upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={doc.checked ? 0 : -1}
          aria-label={`Upload file for ${doc.label}`}
          className={cn(
            'flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-3 text-center transition-colors',
            'hover:border-primary-400 hover:bg-primary-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
            doc.filePath
              ? 'border-success/40 bg-success-bg'
              : doc.pendingFile
                ? 'border-primary-300 bg-primary-50'
                : error
                  ? 'border-danger/40 bg-danger-bg'
                  : 'border-neutral-300 bg-neutral-50',
          )}
        >
          {doc.filePath ? (
            <div className="flex items-center gap-2">
              <FileIcon />
              <span className="text-xs font-medium text-success-fg">File uploaded</span>
            </div>
          ) : doc.pendingFile ? (
            <div className="flex items-center gap-2">
              <FileIcon />
              <span className="text-xs font-medium text-neutral-700">
                {doc.pendingFile.name}
              </span>
            </div>
          ) : (
            <>
              <UploadIcon />
              <span className="text-xs text-neutral-500">
                Drop file here or click to browse
              </span>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileChange(file);
            e.target.value = '';
          }}
          tabIndex={-1}
        />

        {uploadError && (
          <p className="flex items-center gap-1 text-xs text-danger" role="alert">
            <AlertIcon size={12} />
            {uploadError}
          </p>
        )}

        {error && !uploadError && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Date fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker
            label="Issue date"
            value={doc.issueDate}
            setValue={(iso) => onUpdate({ issueDate: iso })}
            minYear={2000}
          />
          <DatePicker
            label="Expiry date"
            value={doc.expiryDate}
            setValue={(iso) => onUpdate({ expiryDate: iso })}
            minYear={2024}
            maxYear={2040}
          />
        </div>
      </div>
    </div>
  );
}

/* ──────── Icons ──────── */

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-400"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-success"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
