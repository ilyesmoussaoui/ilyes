import type { FastifyInstance } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/auth.middleware.js';
import { alertsQuerySchema, alertsResponseSchema } from './dashboard.schema.js';
import { getDashboardAlerts } from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requireRole('admin', 'manager', 'receptionist', 'accountant');

  // ─── GET /dashboard/alerts ─────────────────────────────────────────────────
  app.get(
    '/alerts',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = alertsQuerySchema.safeParse(request.query);
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

      request.log.info(
        {
          userId: request.user?.id,
          action: 'get_dashboard_alerts',
          params: parsed.data,
        },
        'Fetching dashboard alerts',
      );

      const result = await getDashboardAlerts(parsed.data);

      // Validate response shape against Zod schema before sending.
      // This acts as a runtime contract check; type errors here indicate
      // a service regression.
      const validated = alertsResponseSchema.safeParse(result);
      if (!validated.success) {
        request.log.error(
          { err: validated.error, userId: request.user?.id },
          'Dashboard alerts response failed schema validation',
        );
        return reply
          .status(500)
          .send(fail('INTERNAL_ERROR', 'An unexpected error occurred'));
      }

      return reply.send(ok(validated.data));
    },
  );
}
