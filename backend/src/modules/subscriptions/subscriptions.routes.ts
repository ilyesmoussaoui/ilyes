import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  SubscriptionError,
  processAutoRenewals,
} from './subscriptions.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleSubscriptionError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof SubscriptionError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function subscriptionsRoutes(app: FastifyInstance): Promise<void> {
  const adminOnly = requireRole('admin');

  // ─── POST /subscriptions/process-renewals — Auto-renew expired subscriptions
  app.post(
    '/process-renewals',
    { preHandler: [requireAuth, adminOnly] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      request.log.info(
        { userId, action: 'process_renewals' },
        'Processing auto-renewals',
      );

      try {
        const result = await processAutoRenewals(userId);
        return reply.send(ok(result));
      } catch (err) {
        if (handleSubscriptionError(err, reply)) return;
        throw err;
      }
    },
  );
}
