import type { FastifyInstance } from 'fastify';
import { ok } from '../lib/response.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ok({ status: 'ok' }));
}
