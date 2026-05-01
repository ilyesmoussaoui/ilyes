import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  memberIdParamSchema,
  enrollmentIdParamSchema,
  documentIdParamSchema,
  subscriptionIdParamSchema,
  updateEnrollmentSchema,
  addEnrollmentSchema,
  updateDocumentSchema,
  addDocumentSchema,
  updateSubscriptionSchema,
  renewSubscriptionSchema,
} from './edit.types.js';
import {
  EditError,
  updateEnrollment,
  deleteEnrollment,
  addEnrollment,
  updateDocument,
  deleteDocument,
  addDocument,
  updateSubscription,
  renewSubscription,
} from './edit.service.js';

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleEditError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof EditError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

export async function editRoutes(app: FastifyInstance): Promise<void> {
  const canWrite = requireRole('admin', 'manager', 'receptionist');

  // ─── PATCH /:id/enrollments/:enrollmentId ─────────────────────────────────
  app.patch(
    '/:id/enrollments/:enrollmentId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = enrollmentIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid path parameters', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = updateEnrollmentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const enrollment = await updateEnrollment(
          paramsParsed.data.id,
          paramsParsed.data.enrollmentId,
          bodyParsed.data,
          userId,
        );
        return reply.send(ok({ enrollment }));
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /:id/enrollments/:enrollmentId ────────────────────────────────
  app.delete(
    '/:id/enrollments/:enrollmentId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = enrollmentIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid path parameters', paramsParsed.error.flatten().fieldErrors),
          );
      }

      try {
        await deleteEnrollment(paramsParsed.data.id, paramsParsed.data.enrollmentId, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /:id/enrollments/add ────────────────────────────────────────────
  app.post(
    '/:id/enrollments/add',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = memberIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = addEnrollmentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const result = await addEnrollment(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.status(201).send(
          ok({
            enrollment: result.enrollment,
            subscription: result.subscription,
            payment: result.payment,
          }),
        );
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PATCH /:id/documents/:documentId ────────────────────────────────────
  app.patch(
    '/:id/documents/:documentId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = documentIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid path parameters', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = updateDocumentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const document = await updateDocument(
          paramsParsed.data.id,
          paramsParsed.data.documentId,
          bodyParsed.data,
          userId,
        );
        return reply.send(ok({ document }));
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /:id/documents/:documentId ───────────────────────────────────
  app.delete(
    '/:id/documents/:documentId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = documentIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid path parameters', paramsParsed.error.flatten().fieldErrors),
          );
      }

      try {
        await deleteDocument(paramsParsed.data.id, paramsParsed.data.documentId, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /:id/documents/add ──────────────────────────────────────────────
  app.post(
    '/:id/documents/add',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = memberIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid member id', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = addDocumentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const document = await addDocument(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.status(201).send(ok({ document }));
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PATCH /:id/subscriptions/:subscriptionId ─────────────────────────────
  app.patch(
    '/:id/subscriptions/:subscriptionId',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = subscriptionIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid path parameters', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = updateSubscriptionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const subscription = await updateSubscription(
          paramsParsed.data.id,
          paramsParsed.data.subscriptionId,
          bodyParsed.data,
          userId,
        );
        return reply.send(ok({ subscription }));
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /:id/subscriptions/:subscriptionId/renew ────────────────────────
  app.post(
    '/:id/subscriptions/:subscriptionId/renew',
    { preHandler: [requireAuth, canWrite] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = subscriptionIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid path parameters', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = renewSubscriptionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const subscription = await renewSubscription(
          paramsParsed.data.id,
          paramsParsed.data.subscriptionId,
          bodyParsed.data,
          userId,
        );
        return reply.status(201).send(ok({ subscription }));
      } catch (err) {
        if (handleEditError(err, reply)) return;
        throw err;
      }
    },
  );
}
