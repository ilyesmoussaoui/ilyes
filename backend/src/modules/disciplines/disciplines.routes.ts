import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import {
  disciplineIdParamSchema,
  createEnrollmentsSchema,
  memberIdParamSchema,
} from './disciplines.types.js';
import {
  DisciplineError,
  listActiveDisciplines,
  getTimeSlotsForDiscipline,
  getInstructorsForDiscipline,
  createEnrollments,
} from './disciplines.service.js';

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleDisciplineError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof DisciplineError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

export async function disciplinesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireAuth },
    async (_request, reply) => {
      const disciplines = await listActiveDisciplines();
      return reply.send(ok({ disciplines }));
    },
  );

  app.get(
    '/:id/time-slots',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = disciplineIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid discipline id', parsed.error.flatten().fieldErrors),
          );
      }

      try {
        const timeSlots = await getTimeSlotsForDiscipline(parsed.data.id);
        return reply.send(ok({ timeSlots }));
      } catch (err) {
        if (handleDisciplineError(err, reply)) return;
        throw err;
      }
    },
  );

  app.get(
    '/:id/instructors',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = disciplineIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid discipline id', parsed.error.flatten().fieldErrors),
          );
      }

      try {
        const instructors = await getInstructorsForDiscipline(parsed.data.id);
        return reply.send(ok({ instructors }));
      } catch (err) {
        if (handleDisciplineError(err, reply)) return;
        throw err;
      }
    },
  );
}

export async function enrollmentsRoutes(app: FastifyInstance): Promise<void> {
  const canWrite = requirePermission('disciplines', 'create');

  app.post(
    '/:id/enrollments',
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

      const bodyParsed = createEnrollmentsSchema.safeParse(request.body);
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
        const result = await createEnrollments(
          paramsParsed.data.id,
          bodyParsed.data,
          userId,
        );
        return reply.send(ok(result));
      } catch (err) {
        if (handleDisciplineError(err, reply)) return;
        throw err;
      }
    },
  );
}
