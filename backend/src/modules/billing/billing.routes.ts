import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import { createBillingSchema, memberIdParamSchema, searchQuerySchema } from './billing.types.js';
import {
  BillingError,
  getSubscriptionPlans,
  listEquipment,
  searchMembers,
  createBilling,
} from './billing.service.js';

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleBillingError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof BillingError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/subscription-plans',
    { preHandler: requireAuth },
    async (_request, reply) => {
      try {
        const plans = await getSubscriptionPlans();
        return reply.send(ok({ plans }));
      } catch (err) {
        if (handleBillingError(err, reply)) return;
        throw err;
      }
    },
  );

  app.get(
    '/equipment',
    { preHandler: requireAuth },
    async (_request, reply) => {
      try {
        const equipment = await listEquipment();
        return reply.send(ok({ equipment }));
      } catch (err) {
        if (handleBillingError(err, reply)) return;
        throw err;
      }
    },
  );
}

export async function memberSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/search',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = searchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.flatten().fieldErrors),
          );
      }

      try {
        const raw = await searchMembers(parsed.data.q);
        const members = raw.map((m) => ({
          id: m.id,
          firstNameLatin: m.firstNameLatin ?? '',
          lastNameLatin: m.lastNameLatin ?? '',
          firstNameArabic: m.firstNameArabic ?? '',
          lastNameArabic: m.lastNameArabic ?? '',
          photoUrl: m.photoPath ? `/api/v1/files/photos/${m.photoPath}` : null,
        }));
        return reply.send(ok({ members }));
      } catch (err) {
        if (handleBillingError(err, reply)) return;
        throw err;
      }
    },
  );
}

export async function memberBillingRoutes(app: FastifyInstance): Promise<void> {
  const canWrite = requirePermission('payments', 'create');

  app.post(
    '/:id/billing',
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

      const bodyParsed = createBillingSchema.safeParse(request.body);
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
        const result = await createBilling(
          paramsParsed.data.id,
          bodyParsed.data,
          userId,
        );
        return reply.status(201).send(ok(result));
      } catch (err) {
        if (handleBillingError(err, reply)) return;
        throw err;
      }
    },
  );
}
