import type { FastifyInstance, FastifyReply } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  listNotificationsQuerySchema,
  unreadCountResponseSchema,
  uuidParamSchema,
} from './notifications.types.js';
import {
  NotificationError,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service.js';
import { generateAllNotifications } from './notifications.generator.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function handleNotificationError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof NotificationError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requireRole('admin', 'manager', 'receptionist', 'accountant');

  // ─── GET /notifications — List notifications ───────────────────────────────
  app.get(
    '/',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = listNotificationsQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'list_notifications' },
        'Listing notifications',
      );

      try {
        const result = await listNotifications(parsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleNotificationError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /notifications/unread-count — Count of unread notifications ─────────
  app.get(
    '/unread-count',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'get_unread_count' },
        'Fetching unread notification count',
      );

      try {
        const count = await getUnreadCount();
        const parsed = unreadCountResponseSchema.safeParse({ count });
        if (!parsed.success) {
          // Should never happen — count is always a non-negative integer
          request.log.error(
            { userId: request.user?.id, error: parsed.error },
            'Unexpected response shape from getUnreadCount',
          );
          return reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'));
        }
        return reply.send(ok(parsed.data));
      } catch (err) {
        if (handleNotificationError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PATCH /notifications/:id/read — Mark as read ─────────────────────────
  app.patch(
    '/:id/read',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid notification id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        {
          userId: request.user?.id,
          notificationId: paramsParsed.data.id,
          action: 'mark_notification_read',
        },
        'Marking notification as read',
      );

      try {
        const notification = await markNotificationRead(paramsParsed.data.id);
        return reply.send(ok({ notification }));
      } catch (err) {
        if (handleNotificationError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /notifications/mark-all-read — Mark every unread notification ────
  app.post(
    '/mark-all-read',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'mark_all_notifications_read' },
        'Marking all notifications as read',
      );

      try {
        const updated = await markAllNotificationsRead();
        return reply.send(ok({ updated }));
      } catch (err) {
        if (handleNotificationError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /notifications/generate — Manually run the daily generator ──────
  app.post(
    '/generate',
    { preHandler: [requireAuth, requireRole('admin', 'manager')] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'generate_notifications' },
        'Generating notifications on demand',
      );

      try {
        const summary = await generateAllNotifications();
        return reply.send(ok(summary));
      } catch (err) {
        if (handleNotificationError(err, reply)) return;
        throw err;
      }
    },
  );
}
