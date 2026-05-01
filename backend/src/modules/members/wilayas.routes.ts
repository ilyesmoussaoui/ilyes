import type { FastifyInstance } from 'fastify';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { WILAYAS } from './wilayas.constants.js';

export async function wilayasRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireAuth }, async () => ok({ wilayas: WILAYAS }));
}
