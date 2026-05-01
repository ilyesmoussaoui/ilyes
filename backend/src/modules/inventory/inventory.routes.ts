import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  stockAdjustmentSchema,
  listEquipmentQuerySchema,
  uuidParamSchema,
  memberIdParamSchema,
} from './inventory.schema.js';
import {
  InventoryError,
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  deactivateEquipment,
  adjustStock,
  getStockHistory,
  getMemberEquipmentHistory,
} from './inventory.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleInventoryError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof InventoryError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Inventory routes ────────────────────────────────────────────────────────

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requireRole('admin', 'manager', 'receptionist', 'accountant');

  // ─── GET /inventory — List equipment ──────────────────────────────────────
  app.get(
    '/',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = listEquipmentQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'list_equipment' },
        'Listing equipment',
      );

      try {
        const result = await listEquipment(parsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /inventory/:id — Get single equipment with stock history ─────────
  app.get(
    '/:id',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid equipment id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId: request.user?.id, equipmentId: paramsParsed.data.id, action: 'get_equipment' },
        'Getting equipment',
      );

      try {
        const equipment = await getEquipment(paramsParsed.data.id);
        return reply.send(ok({ equipment }));
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /inventory — Create equipment item ─────────────────────────────
  app.post(
    '/',
    { preHandler: [requireAuth, requireRole('admin', 'manager')] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createEquipmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid request body',
              parsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId, name: parsed.data.name, action: 'create_equipment' },
        'Creating equipment',
      );

      try {
        const equipment = await createEquipment(parsed.data, userId);
        return reply.status(201).send(ok({ equipment }));
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PATCH /inventory/:id — Update equipment item ─────────────────────────
  app.patch(
    '/:id',
    { preHandler: [requireAuth, requireRole('admin', 'manager')] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid equipment id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = updateEquipmentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid request body',
              bodyParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId, equipmentId: paramsParsed.data.id, action: 'update_equipment' },
        'Updating equipment',
      );

      try {
        const equipment = await updateEquipment(
          paramsParsed.data.id,
          bodyParsed.data,
          userId,
        );
        return reply.send(ok({ equipment }));
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /inventory/:id — Deactivate equipment item ────────────────────
  app.delete(
    '/:id',
    { preHandler: [requireAuth, requireRole('admin', 'manager')] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid equipment id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId, equipmentId: paramsParsed.data.id, action: 'deactivate_equipment' },
        'Deactivating equipment',
      );

      try {
        await deactivateEquipment(paramsParsed.data.id, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /inventory/:id/adjust — Adjust stock ───────────────────────────
  app.post(
    '/:id/adjust',
    { preHandler: [requireAuth, requireRole('admin', 'manager')] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid equipment id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = stockAdjustmentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid request body',
              bodyParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        {
          userId,
          equipmentId: paramsParsed.data.id,
          quantityChange: bodyParsed.data.quantityChange,
          reason: bodyParsed.data.reason,
          action: 'adjust_stock',
        },
        'Adjusting stock',
      );

      try {
        const result = await adjustStock(
          paramsParsed.data.id,
          bodyParsed.data,
          userId,
        );
        return reply.status(201).send(ok(result));
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /inventory/:id/history — Get stock adjustment history ────────────
  app.get(
    '/:id/history',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid equipment id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId: request.user?.id, equipmentId: paramsParsed.data.id, action: 'get_stock_history' },
        'Getting stock history',
      );

      try {
        const history = await getStockHistory(paramsParsed.data.id);
        return reply.send(ok({ history }));
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );
}

// ─── Member equipment history routes (separate plugin for /members prefix) ──

export async function memberEquipmentRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requireRole('admin', 'manager', 'receptionist', 'accountant');

  // ─── GET /members/:memberId/equipment-history ─────────────────────────────
  app.get(
    '/:memberId/equipment-history',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const paramsParsed = memberIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail(
              'VALIDATION_ERROR',
              'Invalid member id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId: request.user?.id, memberId: paramsParsed.data.memberId, action: 'get_member_equipment_history' },
        'Getting member equipment history',
      );

      try {
        const history = await getMemberEquipmentHistory(paramsParsed.data.memberId);
        return reply.send(ok({ history }));
      } catch (err) {
        if (handleInventoryError(err, reply)) return;
        throw err;
      }
    },
  );
}
