import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Document } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import type { CreateDocumentsInput } from './documents.types.js';

export class DocumentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

function toDateOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00.000Z`);
}

function getDocumentsRoot(): string {
  const env = getEnv();
  return path.resolve(env.PHOTOS_DIR, '..', 'documents');
}

export async function ensureDocumentsDir(): Promise<void> {
  const root = getDocumentsRoot();
  await fs.mkdir(root, { recursive: true });
}

export async function createDocuments(
  memberId: string,
  input: CreateDocumentsInput,
  _userId: string,
): Promise<Document[]> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
  });
  if (!member) {
    throw new DocumentError('NOT_FOUND', 'Member not found', 404);
  }

  // Replace strategy: delete existing, create new
  const created = await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany({ where: { memberId } });

    const docs: Document[] = [];
    for (const doc of input.documents) {
      const created = await tx.document.create({
        data: {
          memberId,
          type: doc.type,
          filePath: '', // Will be set on upload
          issueDate: toDateOrNull(doc.issueDate),
          expiryDate: toDateOrNull(doc.expiryDate),
          status: 'pending',
        },
      });
      docs.push(created);
    }
    return docs;
  });

  return created;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export type UploadDocumentInput = {
  memberId: string;
  documentId: string;
  mimeType: string;
  bytes: Buffer;
};

export type UploadDocumentResult = {
  documentId: string;
  filePath: string;
};

export async function uploadDocumentFile(
  input: UploadDocumentInput,
): Promise<UploadDocumentResult> {
  const { memberId, documentId, mimeType, bytes } = input;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new DocumentError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Document must be PDF, JPEG, or PNG',
      415,
    );
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
  });
  if (!member) {
    throw new DocumentError('NOT_FOUND', 'Member not found', 404);
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, memberId, deletedAt: null },
  });
  if (!document) {
    throw new DocumentError('NOT_FOUND', 'Document record not found', 404);
  }

  const ext = MIME_TO_EXT[mimeType]!;
  const root = getDocumentsRoot();
  const memberDir = path.join(root, memberId);
  await fs.mkdir(memberDir, { recursive: true });

  const filename = `${document.type}-${Date.now()}.${ext}`;
  const absPath = path.join(memberDir, filename);
  await fs.writeFile(absPath, bytes);

  const relPath = path.join(memberId, filename);

  await prisma.document.update({
    where: { id: documentId },
    data: { filePath: relPath, status: 'valid' },
  });

  return { documentId, filePath: relPath };
}
