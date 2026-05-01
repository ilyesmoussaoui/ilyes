import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import { createDocumentsSchema, memberIdParamSchema } from './documents.types.js';
import {
  DocumentError,
  createDocuments,
  uploadDocumentFile,
  ensureDocumentsDir,
} from './documents.service.js';

const DOC_MAX_BYTES = 5 * 1024 * 1024;

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleDocumentError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof DocumentError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

export async function documentsRoutes(app: FastifyInstance): Promise<void> {
  const canWrite = requirePermission('documents', 'create');

  await ensureDocumentsDir();

  app.post(
    '/:id/documents',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = memberIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid member id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = createDocumentsSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid request body',
              bodyParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const documents = await createDocuments(
          paramsParsed.data.id,
          bodyParsed.data,
          userId,
        );
        return reply.send(ok({ documents }));
      } catch (err) {
        if (handleDocumentError(err, reply)) return;
        throw err;
      }
    },
  );

  app.post(
    '/:id/documents/upload',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = memberIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid member id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      if (!request.isMultipart()) {
        return reply
          .status(415)
          .send(fail('UNSUPPORTED_MEDIA_TYPE', 'Expected multipart/form-data'));
      }

      let documentId: string | null = null;
      let fileBuffer: Buffer | null = null;
      let fileMimeType: string | null = null;

      const parts = request.parts({ limits: { fileSize: DOC_MAX_BYTES, files: 1, fields: 5 } });

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'documentId' && typeof part.value === 'string') {
            documentId = part.value;
          }
        } else if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            // Consume the stream to avoid hang
            await part.toBuffer();
            continue;
          }
          fileMimeType = part.mimetype;
          try {
            fileBuffer = await part.toBuffer();
          } catch (err: unknown) {
            const e = err as { code?: string };
            if (e && e.code === 'FST_REQ_FILE_TOO_LARGE') {
              return reply
                .status(413)
                .send(fail('PAYLOAD_TOO_LARGE', 'Document exceeds 5MB limit'));
            }
            throw err;
          }
          if (part.file.truncated) {
            return reply
              .status(413)
              .send(fail('PAYLOAD_TOO_LARGE', 'Document exceeds 5MB limit'));
          }
        }
      }

      if (!fileBuffer || !fileMimeType) {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'Missing "file" field'));
      }

      if (!documentId) {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'Missing "documentId" field'));
      }

      const docIdParsed = z.string().uuid('Invalid document id').safeParse(documentId);
      if (!docIdParsed.success) {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'Invalid document id'));
      }

      try {
        const result = await uploadDocumentFile({
          memberId: paramsParsed.data.id,
          documentId: docIdParsed.data,
          mimeType: fileMimeType,
          bytes: fileBuffer,
        });
        return reply.send(ok(result));
      } catch (err) {
        if (handleDocumentError(err, reply)) return;
        throw err;
      }
    },
  );
}
