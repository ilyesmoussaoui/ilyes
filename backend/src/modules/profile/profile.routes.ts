import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  uuidParamSchema,
  noteIdParamSchema,
  familyLinkIdParamSchema,
  attendanceQuerySchema,
  paymentsQuerySchema,
  auditLogQuerySchema,
  createNoteSchema,
  updateNoteSchema,
  createFamilyLinkSchema,
} from './profile.types.js';
import {
  ProfileError,
  getFullProfile,
  getAttendance,
  getPayments,
  getAuditLog,
  createNote,
  updateNote,
  deleteNote,
  createFamilyLink,
  deleteFamilyLink,
} from './profile.service.js';

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleProfileError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof ProfileError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  const canWrite = requireRole('admin', 'manager', 'receptionist');

  // ─── GET /:id/profile ───────────────────────────────────────────────────────
  app.get(
    '/:id/profile',
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const profile = await getFullProfile(paramsParsed.data.id);
        return reply.send(ok({ member: profile }));
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /:id/attendance ────────────────────────────────────────────────────
  app.get(
    '/:id/attendance',
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const queryParsed = attendanceQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid query parameters',
              queryParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const result = await getAttendance(paramsParsed.data.id, queryParsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /:id/payments ──────────────────────────────────────────────────────
  app.get(
    '/:id/payments',
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const queryParsed = paymentsQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid query parameters',
              queryParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const result = await getPayments(paramsParsed.data.id, queryParsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /:id/audit-log ─────────────────────────────────────────────────────
  app.get(
    '/:id/audit-log',
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const queryParsed = auditLogQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid query parameters',
              queryParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const result = await getAuditLog(paramsParsed.data.id, queryParsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /:id/notes ────────────────────────────────────────────────────────
  app.post(
    '/:id/notes',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = createNoteSchema.safeParse(request.body);
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
        const note = await createNote(paramsParsed.data.id, bodyParsed.data.content, userId);
        return reply.status(201).send(ok({ note }));
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PATCH /:id/notes/:noteId ────────────────────────────────────────────────
  app.patch(
    '/:id/notes/:noteId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = noteIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid path parameters',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = updateNoteSchema.safeParse(request.body);
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
        const note = await updateNote(
          paramsParsed.data.id,
          paramsParsed.data.noteId,
          bodyParsed.data.content,
          userId,
        );
        return reply.send(ok({ note }));
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /:id/notes/:noteId ───────────────────────────────────────────────
  app.delete(
    '/:id/notes/:noteId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = noteIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid path parameters',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        await deleteNote(paramsParsed.data.id, paramsParsed.data.noteId, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /:id/family-links ──────────────────────────────────────────────────
  app.post(
    '/:id/family-links',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = createFamilyLinkSchema.safeParse(request.body);
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
        const link = await createFamilyLink(
          paramsParsed.data.id,
          bodyParsed.data.relatedMemberId,
          bodyParsed.data.relationship,
          userId,
        );
        return reply.status(201).send(ok({ link }));
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /:id/family-links/:linkId ────────────────────────────────────────
  app.delete(
    '/:id/family-links/:linkId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = familyLinkIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid path parameters',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        await deleteFamilyLink(paramsParsed.data.id, paramsParsed.data.linkId, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleProfileError(err, reply)) return;
        throw err;
      }
    },
  );
}
