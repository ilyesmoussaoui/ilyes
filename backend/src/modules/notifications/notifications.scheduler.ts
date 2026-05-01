import cron, { type ScheduledTask } from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { generateAllNotifications } from './notifications.generator.js';

let task: ScheduledTask | null = null;

// Default: every day at 07:00 in the server's timezone.
const DEFAULT_CRON = '0 7 * * *';

export function startNotificationScheduler(logger: FastifyBaseLogger): void {
  const expr = process.env.NOTIFICATIONS_CRON ?? DEFAULT_CRON;
  if (!cron.validate(expr)) {
    logger.error({ expr }, 'Invalid NOTIFICATIONS_CRON expression; scheduler disabled');
    return;
  }
  task = cron.schedule(
    expr,
    () => {
      logger.info('Daily notification generation starting');
      void generateAllNotifications()
        .then((summary) => logger.info({ summary }, 'Notification generation complete'))
        .catch((err: Error) =>
          logger.error({ err: err.message }, 'Notification generation failed'),
        );
    },
    { timezone: process.env.TZ ?? 'Africa/Algiers' },
  );
  logger.info({ expr }, 'Notification scheduler started');
}

export function stopNotificationScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
