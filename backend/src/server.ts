import { buildApp } from './app.js';
import { getEnv } from './config/env.js';

async function start(): Promise<void> {
  const env = getEnv();
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`gym-saas backend listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void start();
