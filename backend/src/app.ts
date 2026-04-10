import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { getEnv } from './config/env.js';
import { fail } from './lib/response.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    disableRequestLogging: false,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const status = error.statusCode ?? 500;
    const code = status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
    reply.status(status).send(fail(code, error.message));
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(fail('NOT_FOUND', 'Route not found'));
  });

  await app.register(
    async (v1) => {
      await v1.register(healthRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
