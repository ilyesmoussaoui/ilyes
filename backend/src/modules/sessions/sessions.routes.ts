import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  uuidParamSchema,
  timeSlotsQuerySchema,
  createTimeSlotSchema,
  updateTimeSlotSchema,
  markAttendanceSchema,
  checkConflictsSchema,
  enrollMemberSchema,
  enrollmentParamSchema,
} from './sessions.types.js';
import {
  SessionsError,
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  getTimeSlotRoster,
  markAttendance,
  checkConflicts,
  enrollMember,
  unenrollMember,
  getSessionCoaches,
} from './sessions.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleSessionsError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof SessionsError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function sessionsRoutes(app: FastifyInstance): Promise<void> {
  const canManage = requireRole('admin', 'manager', 'coach');

  // ─── GET /time-slots ──────────────────────────────────────────────────────────
  app.get(
    '/time-slots',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const parsed = timeSlotsQuerySchema.safeParse(request.query);
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

      try {
        const timeSlots = await getTimeSlots(parsed.data);
        return reply.send(ok({ timeSlots }));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /time-slots ─────────────────────────────────────────────────────────
  app.post(
    '/time-slots',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const parsed = createTimeSlotSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid request body',
              parsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const result = await createTimeSlot(parsed.data);
        return reply.status(201).send(ok(result));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PUT /time-slots/:id ──────────────────────────────────────────────────────
  app.put(
    '/time-slots/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid time slot id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = updateTimeSlotSchema.safeParse(request.body);
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
        const result = await updateTimeSlot(paramsParsed.data.id, bodyParsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /time-slots/:id ───────────────────────────────────────────────────
  app.delete(
    '/time-slots/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid time slot id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        await deleteTimeSlot(paramsParsed.data.id);
        return reply.status(204).send();
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /time-slots/:id/roster ───────────────────────────────────────────────
  app.get(
    '/time-slots/:id/roster',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid time slot id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const result = await getTimeSlotRoster(paramsParsed.data.id);
        return reply.send(ok(result));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /time-slots/:id/attendance ──────────────────────────────────────────
  app.post(
    '/time-slots/:id/attendance',
    { preHandler: [requireAuth, canManage] },
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
              'Invalid time slot id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = markAttendanceSchema.safeParse(request.body);
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
        const result = await markAttendance(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.status(201).send(ok(result));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /check-conflicts ────────────────────────────────────────────────────
  app.post(
    '/check-conflicts',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const parsed = checkConflictsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid request body',
              parsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const result = await checkConflicts(parsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /time-slots/:id/enroll ──────────────────────────────────────────────
  app.post(
    '/time-slots/:id/enroll',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid time slot id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = enrollMemberSchema.safeParse(request.body);
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
        const result = await enrollMember(paramsParsed.data.id, bodyParsed.data);
        return reply.status(201).send(ok(result));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /time-slots/:id/members/:memberId ─────────────────────────────────
  app.delete(
    '/time-slots/:id/members/:memberId',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const paramsParsed = enrollmentParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid parameters',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        await unenrollMember(paramsParsed.data.id, paramsParsed.data.memberId);
        return reply.status(204).send();
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /coaches ─────────────────────────────────────────────────────────────
  app.get(
    '/coaches',
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      try {
        const result = await getSessionCoaches();
        return reply.send(ok(result));
      } catch (err) {
        if (handleSessionsError(err, reply)) return;
        throw err;
      }
    },
  );
}
