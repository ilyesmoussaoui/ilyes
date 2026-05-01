import type { FastifyInstance, FastifyReply } from 'fastify';
import { getEnv } from '../../config/env.js';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  BackupError,
  createBackup,
  isRestoreActive,
  listBackups,
  restoreBackup,
} from './backups.service.js';
import { restoreBackupSchema } from './backups.types.js';

function handleBackupError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof BackupError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

export async function backupsRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/backups — list backups
  app.get(
    '/',
    { preHandler: [requireAuth, requireRole('admin')] },
    async (_request, reply) => {
      try {
        const items = await listBackups();
        return reply.send(ok({ backups: items }));
      } catch (err) {
        if (handleBackupError(err, reply)) return;
        throw err;
      }
    },
  );

  // POST /admin/backups — trigger a manual backup
  app.post(
    '/',
    { preHandler: [requireAuth, requireRole('admin')] },
    async (request, reply) => {
      try {
        const meta = await createBackup('manual', request.user?.id ?? null);
        return reply.status(201).send(ok({ backup: meta }));
      } catch (err) {
        if (handleBackupError(err, reply)) return;
        throw err;
      }
    },
  );

  // POST /admin/backups/restore
  app.post(
    '/restore',
    { preHandler: [requireAuth, requireRole('admin')] },
    async (request, reply) => {
      const env = getEnv();
      if (!env.BACKUP_RESTORE_TOKEN) {
        return reply
          .status(503)
          .send(fail('RESTORE_DISABLED', 'BACKUP_RESTORE_TOKEN is not configured on the server'));
      }

      const parsed = restoreBackupSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      if (parsed.data.confirmToken !== env.BACKUP_RESTORE_TOKEN) {
        return reply.status(403).send(fail('INVALID_TOKEN', 'Invalid confirmation token'));
      }

      if (isRestoreActive()) {
        return reply
          .status(409)
          .send(fail('RESTORE_IN_PROGRESS', 'A restore is already in progress'));
      }

      try {
        const result = await restoreBackup(parsed.data.filename, request.user!.id);
        return reply.send(ok(result));
      } catch (err) {
        if (handleBackupError(err, reply)) return;
        throw err;
      }
    },
  );
}
