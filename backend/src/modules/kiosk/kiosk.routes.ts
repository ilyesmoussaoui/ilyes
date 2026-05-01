import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { getIO } from '../../lib/socket.js';
import { matchSchema, kioskCheckInSchema, searchQuerySchema } from './kiosk.types.js';
import {
  KioskError,
  matchMemberByFace,
  kioskCheckIn,
  searchMembers,
  callFaceServiceHealth,
} from './kiosk.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleKioskError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof KioskError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function kioskRoutes(app: FastifyInstance): Promise<void> {
  const canOperate = requireRole('admin', 'manager', 'receptionist');

  // ─── POST /match ──────────────────────────────────────────────────────────────
  app.post(
    '/match',
    { preHandler: [requireAuth, canOperate] },
    async (request, reply) => {
      const parsed = matchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      try {
        const result = await matchMemberByFace(parsed.data.image_base64);
        return reply.send(ok(result));
      } catch (err) {
        if (handleKioskError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /check-in ──────────────────────────────────────────────────────────
  app.post(
    '/check-in',
    { preHandler: [requireAuth, canOperate] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = kioskCheckInSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      try {
        const result = await kioskCheckIn(
          parsed.data.member_id,
          parsed.data.method,
          userId,
          parsed.data.discipline_id,
          parsed.data.confidence,
        );

        // Emit real-time event (same pattern as attendance module)
        try {
          getIO().emit('attendance:checkin', result.record);
        } catch {
          // Socket.IO not initialised in test — non-fatal
        }

        return reply.status(201).send(ok(result));
      } catch (err) {
        if (handleKioskError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /search ──────────────────────────────────────────────────────────────
  app.get(
    '/search',
    { preHandler: [requireAuth, canOperate] },
    async (request, reply) => {
      const parsed = searchQuerySchema.safeParse(request.query);
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
        const members = await searchMembers(parsed.data.q);
        return reply.send(ok({ members }));
      } catch (err) {
        if (handleKioskError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /face-service/health ─────────────────────────────────────────────────
  app.get(
    '/face-service/health',
    { preHandler: [requireAuth, canOperate] },
    async (_request, reply) => {
      try {
        const health = await callFaceServiceHealth();
        return reply.send(ok(health));
      } catch (err) {
        if (handleKioskError(err, reply)) return;
        throw err;
      }
    },
  );
}
