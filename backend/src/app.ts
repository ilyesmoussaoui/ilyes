import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from './config/env.js';
import { fail } from './lib/response.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { membersRoutes, photoFilesRoutes } from './modules/members/members.routes.js';
import { wilayasRoutes } from './modules/members/wilayas.routes.js';
import { disciplinesRoutes, enrollmentsRoutes } from './modules/disciplines/disciplines.routes.js';
import { documentsRoutes } from './modules/documents/documents.routes.js';
import { billingRoutes, memberBillingRoutes, memberSearchRoutes } from './modules/billing/billing.routes.js';
import { profileRoutes } from './modules/profile/profile.routes.js';
import { editRoutes } from './modules/edit/edit.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { kioskRoutes } from './modules/kiosk/kiosk.routes.js';
import { paymentsRoutes, posRoutes } from './modules/payments/payments.routes.js';
import { expensesRoutes } from './modules/expenses/expenses.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes.js';
import { inventoryRoutes, memberEquipmentRoutes } from './modules/inventory/inventory.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { ensurePhotosDir } from './modules/members/members.service.js';
import { backupsRoutes } from './modules/backups/backups.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { ensureBackupsDir } from './modules/backups/backups.service.js';
import { startBackupScheduler, stopBackupScheduler } from './modules/backups/backups.scheduler.js';
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from './modules/notifications/notifications.scheduler.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv();
  await ensurePhotosDir();
  await ensureBackupsDir();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    disableRequestLogging: false,
    // 10 MB: accommodates base64 logos embedded in settings payloads and
    // large member photos uploaded as data URLs through JSON endpoints.
    bodyLimit: 10 * 1024 * 1024,
  });

  // Replace the default JSON content-type parser so that requests with an
  // empty body (e.g. POST /:id/finalize with no payload) are accepted instead
  // of rejected with a parse error.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const str = typeof body === 'string' ? body : '';
    if (str.trim() === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(str));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    hook: 'onRequest',
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Client-Timestamp', 'X-Offline-Replay'],
    exposedHeaders: ['X-Request-Id'],
  });

  // Global rate limit: 100 requests per minute per IP (authenticated routes
  // will key on user id via keyGenerator override).
  // Auth endpoints have their own stricter per-email in-memory limiting.
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    // Key by authenticated user id when available, fall back to IP.
    keyGenerator: (request) => {
      return (request.user as { id?: string } | undefined)?.id ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Limit is ${context.max} per ${context.after}. Retry after ${context.after}.`,
      },
    }),
  });

  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
      fields: 10,
    },
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const status = error.statusCode ?? 500;
    const isInternal = status >= 500;
    const code = isInternal ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
    const message = isInternal ? 'An unexpected error occurred' : error.message;
    reply.status(status).send(fail(code, message));
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(fail('NOT_FOUND', 'Route not found'));
  });

  await app.register(
    async (v1) => {
      await v1.register(healthRoutes);
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(membersRoutes, { prefix: '/members' });
      await v1.register(memberSearchRoutes, { prefix: '/members' });
      await v1.register(enrollmentsRoutes, { prefix: '/members' });
      await v1.register(documentsRoutes, { prefix: '/members' });
      await v1.register(memberBillingRoutes, { prefix: '/members' });
      await v1.register(profileRoutes, { prefix: '/members' });
      await v1.register(editRoutes, { prefix: '/members' });
      await v1.register(wilayasRoutes, { prefix: '/wilayas' });
      await v1.register(disciplinesRoutes, { prefix: '/disciplines' });
      await v1.register(billingRoutes, { prefix: '' });
      await v1.register(photoFilesRoutes, { prefix: '/files' });
      await v1.register(attendanceRoutes, { prefix: '/attendance' });
      await v1.register(kioskRoutes, { prefix: '/kiosk' });
      await v1.register(paymentsRoutes, { prefix: '/payments' });
      await v1.register(posRoutes, { prefix: '/pos' });
      await v1.register(expensesRoutes, { prefix: '/expenses' });
      await v1.register(notificationsRoutes, { prefix: '/notifications' });
      await v1.register(subscriptionsRoutes, { prefix: '/subscriptions' });
      await v1.register(inventoryRoutes, { prefix: '/inventory' });
      await v1.register(memberEquipmentRoutes, { prefix: '/members' });
      await v1.register(sessionsRoutes, { prefix: '/sessions' });
      await v1.register(reportsRoutes, { prefix: '/reports' });
      await v1.register(settingsRoutes, { prefix: '/settings' });
      await v1.register(backupsRoutes, { prefix: '/admin/backups' });
      await v1.register(dashboardRoutes, { prefix: '/dashboard' });
      await v1.register(searchRoutes, { prefix: '/search' });
      await v1.register(tasksRoutes, { prefix: '/tasks' });
    },
    { prefix: '/api/v1' },
  );

  // Start the nightly backup cron. Tests can disable by NODE_ENV=test.
  if (env.NODE_ENV !== 'test') {
    startBackupScheduler(app.log);
    startNotificationScheduler(app.log);
    app.addHook('onClose', async () => {
      stopBackupScheduler();
      stopNotificationScheduler();
    });
  }

  return app;
}
