import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import {
  checkDuplicateQuerySchema,
  createMemberSchema,
  listMembersQuerySchema,
  photoFileParamsSchema,
  updateMemberSchema,
  uuidParamSchema,
} from './members.types.js';
import {
  MemberError,
  createMember,
  deleteMember,
  findDuplicates,
  finalizeMember,
  getMemberWithRelations,
  getPhotoStream,
  listMembers,
  savePhoto,
  updateMember,
} from './members.service.js';

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleMemberError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof MemberError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

export async function membersRoutes(app: FastifyInstance): Promise<void> {
  const canWrite = requirePermission('members', 'create');
  const canDelete = requirePermission('members', 'delete');

  app.get(
    '/',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = listMembersQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid query parameters',
              parsed.error.flatten().fieldErrors,
            ),
          );
      }
      const result = await listMembers(parsed.data);
      return reply.send(ok(result));
    },
  );

  app.get(
    '/check-duplicate',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = checkDuplicateQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid query parameters',
              parsed.error.flatten().fieldErrors,
            ),
          );
      }
      const { firstName, lastName, lang } = parsed.data;
      const duplicates = await findDuplicates(firstName, lastName, lang);
      return reply.send(ok({ duplicates }));
    },
  );

  app.post(
    '/',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      const member = await createMember(parsed.data, userId);
      return reply.status(201).send(
        ok({
          id: member.id,
          type: member.type,
          status: member.status,
          createdAt: member.createdAt.toISOString(),
        }),
      );
    },
  );

  app.patch(
    '/:id',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
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

      const bodyParsed = updateMemberSchema.safeParse(request.body);
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
        const updated = await updateMember(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.send(ok({ member: updated }));
      } catch (err) {
        if (handleMemberError(err, reply)) return;
        throw err;
      }
    },
  );

  app.get(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
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
      const member = await getMemberWithRelations(paramsParsed.data.id);
      if (!member) {
        return reply.status(404).send(fail('NOT_FOUND', 'Member not found'));
      }
      return reply.send(ok({ member }));
    },
  );

  app.delete(
    '/:id',
    { preHandler: [requireAuth, canDelete] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
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

      try {
        await deleteMember(paramsParsed.data.id, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleMemberError(err, reply)) return;
        throw err;
      }
    },
  );

  app.post(
    '/:id/finalize',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
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

      try {
        const member = await finalizeMember(paramsParsed.data.id, userId);
        return reply.send(ok({ member }));
      } catch (err) {
        if (handleMemberError(err, reply)) return;
        throw err;
      }
    },
  );

  app.post(
    '/:id/photo',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
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

      const file = await request.file({
        limits: { fileSize: PHOTO_MAX_BYTES, files: 1 },
      });
      if (!file) {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'Missing "photo" file field'));
      }
      if (file.fieldname !== 'photo') {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'File field must be named "photo"'));
      }

      let bytes: Buffer;
      try {
        bytes = await file.toBuffer();
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e && e.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply
            .status(413)
            .send(fail('PAYLOAD_TOO_LARGE', 'Photo exceeds 5MB limit'));
        }
        throw err;
      }

      if (file.file.truncated) {
        return reply
          .status(413)
          .send(fail('PAYLOAD_TOO_LARGE', 'Photo exceeds 5MB limit'));
      }

      try {
        const result = await savePhoto({
          memberId: paramsParsed.data.id,
          mimeType: file.mimetype,
          bytes,
          userId,
        });
        return reply.send(ok(result));
      } catch (err) {
        if (handleMemberError(err, reply)) return;
        throw err;
      }
    },
  );
}

export async function photoFilesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/photos/:memberId/:filename',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = photoFileParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid path', parsed.error.flatten().fieldErrors),
          );
      }

      try {
        const result = await getPhotoStream(parsed.data.memberId, parsed.data.filename);
        reply.header('Content-Type', result.contentType);
        reply.header('Content-Length', result.size);
        reply.header('Cache-Control', 'private, max-age=300');
        return reply.send(result.stream);
      } catch (err) {
        if (handleMemberError(err, reply)) return;
        throw err;
      }
    },
  );
}
