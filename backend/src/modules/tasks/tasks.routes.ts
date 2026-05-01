import type { FastifyInstance, FastifyReply } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import { createTaskSchema, listTasksQuerySchema } from './tasks.types.js';
import { TaskError, createTask, listTasks } from './tasks.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleTaskError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof TaskError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function tasksRoutes(app: FastifyInstance): Promise<void> {
  const canView   = requirePermission('tasks', 'view');
  const canCreate = requirePermission('tasks', 'create');

  // ─── POST /tasks ──────────────────────────────────────────────────────────
  // Auth: required — admin or manager (tasks:create permission)
  // Body: { type, memberId?, assignedTo?, dueDate?, notes? }
  // 201: { success: true, data: { task } }
  // 422: validation error
  // 403: forbidden
  app.post(
    '/',
    { preHandler: [requireAuth, canCreate] },
    async (request, reply) => {
      const parsed = createTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId: request.user?.id, type: parsed.data.type, memberId: parsed.data.memberId },
        'Creating task',
      );

      try {
        const task = await createTask({
          type: parsed.data.type,
          memberId: parsed.data.memberId,
          assignedTo: parsed.data.assignedTo,
          dueDate: parsed.data.dueDate,
          notes: parsed.data.notes,
          createdBy: request.user?.id,
        });
        return reply.status(201).send(ok({ task }));
      } catch (err) {
        if (handleTaskError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /tasks ───────────────────────────────────────────────────────────
  // Auth: required — any authenticated user with tasks:view permission
  // Query: ?status=open|done|cancelled &memberId=uuid &assignedTo=uuid &page=1 &limit=20
  // 200: { success: true, data: { tasks, total, page, limit } }
  // 422: invalid query
  app.get(
    '/',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      const parsed = listTasksQuerySchema.safeParse(request.query);
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
        const result = await listTasks(parsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleTaskError(err, reply)) return;
        throw err;
      }
    },
  );
}
