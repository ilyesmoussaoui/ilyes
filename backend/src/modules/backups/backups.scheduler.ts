import cron, { type ScheduledTask } from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { getEnv } from '../../config/env.js';
import { createBackup, rotateBackups } from './backups.service.js';

let task: ScheduledTask | null = null;

export function startBackupScheduler(logger: FastifyBaseLogger): void {
  const env = getEnv();
  if (!cron.validate(env.BACKUP_CRON)) {
    logger.error({ expr: env.BACKUP_CRON }, 'Invalid BACKUP_CRON expression; scheduler disabled');
    return;
  }
  task = cron.schedule(
    env.BACKUP_CRON,
    () => {
      logger.info('Nightly backup starting');
      void createBackup('nightly', null)
        .then((meta) => logger.info({ meta }, 'Nightly backup completed'))
        .catch((err: Error) => logger.error({ err: err.message }, 'Nightly backup failed'))
        .finally(() => {
          void rotateBackups()
            .then((r) => logger.info({ pruned: r.pruned }, 'Backup rotation complete'))
            .catch((err: Error) => logger.error({ err: err.message }, 'Backup rotation failed'));
        });
    },
    { timezone: process.env.TZ ?? 'Africa/Algiers' },
  );
  logger.info({ expr: env.BACKUP_CRON }, 'Backup scheduler started');
}

export function stopBackupScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
