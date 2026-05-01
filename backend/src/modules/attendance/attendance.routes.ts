import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import { getIO } from '../../lib/socket.js';
import { prisma } from '../../lib/prisma.js';
import {
  uuidParamSchema,
  memberIdParamSchema,
  checkInSchema,
  updateAttendanceSchema,
  deleteAttendanceSchema,
  logsQuerySchema,
} from './attendance.types.js';
import {
  AttendanceError,
  AttendanceGateError,
  getPresent,
  checkIn,
  checkOut,
  massCheckout,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
  getAttendanceLogs,
  getTodayStats,
  getTodaySessions,
  evaluateCheckInState,
} from './attendance.service.js';
import { checkAbsences } from './absence.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleAttendanceError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof AttendanceGateError) {
    reply.status(403).send({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return true;
  }
  if (err instanceof AttendanceError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  const canOperate = requirePermission('attendance', 'view');
  const canCreate = requirePermission('attendance', 'create');
  const canManage = requirePermission('attendance', 'manage');
  const canEdit = requirePermission('attendance', 'edit');
  const canDelete = requirePermission('attendance', 'delete');

  // ─── GET /present ────────────────────────────────────────────────────────────
  app.get(
    '/present',
    { preHandler: [requireAuth, canOperate] },
    async (_request, reply) => {
      try {
        const records = await getPresent();
        return reply.send(ok({ records }));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /check-in-state/:memberId ───────────────────────────────────────────
  app.get(
    '/check-in-state/:memberId',
    { preHandler: [requireAuth, canOperate] },
    async (request, reply) => {
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

      const { memberId } = paramsParsed.data;

      // Verify member exists
      const member = await prisma.member.findFirst({
        where: { id: memberId, deletedAt: null },
        select: { id: true },
      });
      if (!member) {
        return reply.status(404).send(fail('NOT_FOUND', 'Member not found'));
      }

      try {
        const state = await evaluateCheckInState(memberId);
        return reply.send(ok(state));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /checkin ───────────────────────────────────────────────────────────
  app.post(
    '/checkin',
    { preHandler: [requireAuth, canCreate] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = checkInSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      try {
        const result = await checkIn(parsed.data, userId);
        const { warnings, ...record } = result;
        // Emit real-time event
        try {
          getIO().emit('attendance:checkin', record);
        } catch {
          // Socket.IO not initialised in test — non-fatal
        }
        // 201 with additive warnings array (backwards compatible — callers
        // that ignore unknown fields are unaffected).
        return reply.status(201).send(ok({ record, warnings }));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /:id/checkout ─────────────────────────────────────────────────────
  app.post(
    '/:id/checkout',
    { preHandler: [requireAuth, canCreate] },
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
              'Invalid attendance record id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const record = await checkOut(paramsParsed.data.id);
        // Emit real-time event
        try {
          getIO().emit('attendance:checkout', record);
        } catch {
          // Socket.IO not initialised in test — non-fatal
        }
        return reply.send(ok({ record }));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /mass-checkout ────────────────────────────────────────────────────
  app.post(
    '/mass-checkout',
    { preHandler: [requireAuth, canManage] },
    async (_request, reply) => {
      try {
        const count = await massCheckout();
        const timestamp = new Date().toISOString();
        // Emit real-time event
        try {
          getIO().emit('attendance:mass-checkout', { count, timestamp });
        } catch {
          // Socket.IO not initialised in test — non-fatal
        }
        return reply.send(ok({ count, timestamp }));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /logs ───────────────────────────────────────────────────────────────
  app.get(
    '/logs',
    { preHandler: [requireAuth, canOperate] },
    async (request, reply) => {
      const parsed = logsQuerySchema.safeParse(request.query);
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
        const result = await getAttendanceLogs(parsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /stats/today ────────────────────────────────────────────────────────
  app.get(
    '/stats/today',
    { preHandler: [requireAuth, canOperate] },
    async (_request, reply) => {
      try {
        const stats = await getTodayStats();
        return reply.send(ok(stats));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /sessions/today ─────────────────────────────────────────────────────
  app.get(
    '/sessions/today',
    { preHandler: [requireAuth, canOperate] },
    async (_request, reply) => {
      try {
        const sessions = await getTodaySessions();
        return reply.send(ok({ sessions }));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /:id ────────────────────────────────────────────────────────────────
  app.get(
    '/:id',
    { preHandler: [requireAuth, canOperate] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid attendance record id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      try {
        const record = await getAttendanceById(paramsParsed.data.id);
        return reply.send(ok({ record }));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PATCH /:id ──────────────────────────────────────────────────────────────
  app.patch(
    '/:id',
    { preHandler: [requireAuth, canEdit] },
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
              'Invalid attendance record id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = updateAttendanceSchema.safeParse(request.body);
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
        const record = await updateAttendance(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.send(ok({ record }));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /:id ─────────────────────────────────────────────────────────────
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
              'Invalid attendance record id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = deleteAttendanceSchema.safeParse(request.body);
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
        await deleteAttendance(paramsParsed.data.id, bodyParsed.data.reason, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /check-absences ─────────────────────────────────────────────────
  app.post(
    '/check-absences',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'check_absences' },
        'Checking for consecutive absences',
      );

      try {
        const result = await checkAbsences();
        return reply.send(ok(result));
      } catch (err) {
        if (handleAttendanceError(err, reply)) return;
        throw err;
      }
    },
  );
}
