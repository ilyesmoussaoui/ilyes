import { useState } from 'react';
import { Table, Badge, Modal } from '../../../../components/ui';
import type { MemberProfile, DocumentInfo } from '../profileTypes';
import type { TableColumn } from '../../../../types/ui';
import { formatDate } from '../profileUtils';
import { FileTextIcon } from '../../../../components/ui/Icon';

interface DocumentsSectionProps {
  profile: MemberProfile;
}

const DOC_STATUS_VARIANT: Record<DocumentInfo['status'], 'active' | 'expired' | 'pending'> = {
  valid: 'active',
  expired: 'expired',
  pending: 'pending',
};

const DOC_STATUS_LABEL: Record<DocumentInfo['status'], string> = {
  valid: 'Valid',
  expired: 'Expired',
  pending: 'Pending',
};

function DocumentPreviewModal({
  doc,
  onClose,
}: {
  doc: DocumentInfo | null;
  onClose: () => void;
}) {
  if (!doc) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={doc.type}
      description={`Document details for ${doc.type}`}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Status</p>
            <div className="mt-1">
              <Badge variant={DOC_STATUS_VARIANT[doc.status]} label={DOC_STATUS_LABEL[doc.status]} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Issue date</p>
            <p className="mt-1 text-neutral-900">{formatDate(doc.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Expiry date</p>
            <p className={`mt-1 ${doc.expiryDate && new Date(doc.expiryDate) < new Date() ? 'font-medium text-danger-fg' : 'text-neutral-900'}`}>
              {formatDate(doc.expiryDate)}
            </p>
          </div>
          {doc.notes && (
            <div className="col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Notes</p>
              <p className="mt-1 text-neutral-700">{doc.notes}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 p-8 text-center">
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <FileTextIcon size={32} />
            <p className="text-sm">No file attached</p>
            <p className="text-xs">Files can be uploaded in the Edit member view.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function DocumentsSection({ profile }: DocumentsSectionProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);

  const columns: TableColumn<DocumentInfo>[] = [
    {
      key: 'type',
      header: 'Document type',
      accessor: (row) => (
        <span className="font-medium text-neutral-900">{row.type}</span>
      ),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => (
        <Badge
          variant={DOC_STATUS_VARIANT[row.status]}
          label={DOC_STATUS_LABEL[row.status]}
        />
      ),
    },
    {
      key: 'issueDate',
      header: 'Issue date',
      accessor: (row) => formatDate(row.issueDate),
      sortable: true,
    },
    {
      key: 'expiryDate',
      header: 'Expiry date',
      accessor: (row) => {
        if (!row.expiryDate) return '—';
        const isExpired = new Date(row.expiryDate) < new Date();
        return (
          <span className={isExpired ? 'font-medium text-danger-fg' : ''}>
            {formatDate(row.expiryDate)}
          </span>
        );
      },
      sortable: true,
    },
    {
      key: 'notes',
      header: 'Notes',
      accessor: (row) => (
        <span className="text-neutral-500">{row.notes ?? '—'}</span>
      ),
    },
  ];

  return (
    <section aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="sr-only">Documents</h2>
      <Table
        columns={columns}
        data={profile.documents}
        getRowId={(row) => row.id}
        emptyTitle="No documents"
        emptyMessage="No documents have been uploaded for this member."
        onRowClick={(row) => setSelectedDoc(row)}
      />
      <p className="mt-2 text-xs text-neutral-400">Click a row to preview document details.</p>

      <DocumentPreviewModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
    </section>
  );
}
