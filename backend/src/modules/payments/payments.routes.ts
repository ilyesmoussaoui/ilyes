import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import {
  createPaymentSchema,
  listPaymentsQuerySchema,
  uuidParamSchema,
  createRefundSchema,
  posCheckoutSchema,
  collectPaymentSchema,
  memberIdParamSchema,
} from './payments.types.js';
import {
  PaymentError,
  createPayment,
  listPayments,
  getPaymentById,
  createRefund,
  posCheckout,
  collectPayment,
} from './payments.service.js';
import {
  InventoryError,
  listPosProducts,
  lookupByBarcode,
} from '../inventory/inventory.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handlePaymentError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof PaymentError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requirePermission('payments', 'view');
  const canCreate = requirePermission('payments', 'create');

  // ─── POST /payments — Create a payment ─────────────────────────────────────
  app.post(
    '/',
    { preHandler: [requireAuth, canCreate] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createPaymentSchema.safeParse(request.body);
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
        { userId, memberId: parsed.data.memberId, action: 'create_payment' },
        'Creating payment',
      );

      try {
        const payment = await createPayment(parsed.data, userId);
        return reply.status(201).send(ok({ payment }));
      } catch (err) {
        if (handlePaymentError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /payments — List payments ─────────────────────────────────────────
  app.get(
    '/',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = listPaymentsQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'list_payments' },
        'Listing payments',
      );

      try {
        const result = await listPayments(parsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handlePaymentError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /payments/:id — Get single payment ───────────────────────────────
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
              'Invalid payment id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId: request.user?.id, paymentId: paramsParsed.data.id, action: 'get_payment' },
        'Getting payment',
      );

      try {
        const payment = await getPaymentById(paramsParsed.data.id);
        return reply.send(ok({ payment }));
      } catch (err) {
        if (handlePaymentError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /payments/:id/refund — Create a refund ──────────────────────────
  app.post(
    '/:id/refund',
    { preHandler: [requireAuth, canCreate] },
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
              'Invalid payment id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = createRefundSchema.safeParse(request.body);
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
          originalPaymentId: paramsParsed.data.id,
          action: 'create_refund',
        },
        'Creating refund',
      );

      try {
        const refund = await createRefund(
          paramsParsed.data.id,
          bodyParsed.data.reason,
          userId,
        );
        return reply.status(201).send(ok({ payment: refund }));
      } catch (err) {
        if (handlePaymentError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /members/:memberId/payments/collect ─────────────────────────────
  // Apply a payment against a member's outstanding balance, FIFO across
  // unpaid Payment rows. Mounted under /payments prefix but scoped to member.
  app.post(
    '/members/:memberId/collect',
    { preHandler: [requireAuth, canCreate] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

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

      const bodyParsed = collectPaymentSchema.safeParse(request.body);
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
          memberId: paramsParsed.data.memberId,
          amount: bodyParsed.data.amount,
          action: 'collect_payment',
        },
        'Collecting payment against outstanding balance',
      );

      try {
        const result = await collectPayment(
          paramsParsed.data.memberId,
          bodyParsed.data,
          userId,
        );
        return reply.status(201).send(ok(result));
      } catch (err) {
        if (handlePaymentError(err, reply)) return;
        throw err;
      }
    },
  );
}

// ─── POS routes (separate plugin for /pos prefix) ───────────────────────────

export async function posRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requirePermission('pos', 'view');
  const canCreate = requirePermission('pos', 'create');

  // ─── GET /pos/products — List all active equipment as POS products ────────
  app.get(
    '/products',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_pos_products' },
        'Listing POS products',
      );

      try {
        const products = await listPosProducts();
        return reply.send(ok({ products }));
      } catch (err) {
        if (err instanceof InventoryError) {
          reply.status(err.statusCode).send(fail(err.code, err.message));
          return;
        }
        throw err;
      }
    },
  );

  // ─── GET /pos/barcode/:code — Lookup product by barcode ──────────────────
  app.get(
    '/barcode/:code',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const params = request.params as { code?: string };
      const code = params.code?.trim();

      if (!code || code.length === 0) {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'Barcode is required'));
      }

      request.log.info(
        { userId: request.user?.id, code, action: 'lookup_barcode' },
        'Looking up product by barcode',
      );

      try {
        const product = await lookupByBarcode(code);
        if (!product) {
          return reply
            .status(404)
            .send(fail('NOT_FOUND', 'Product not found for the given barcode'));
        }
        return reply.send(ok({ product }));
      } catch (err) {
        if (err instanceof InventoryError) {
          reply.status(err.statusCode).send(fail(err.code, err.message));
          return;
        }
        throw err;
      }
    },
  );

  // ─── POST /pos/checkout — POS checkout ─────────────────────────────────────
  app.post(
    '/checkout',
    { preHandler: [requireAuth, canCreate] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = posCheckoutSchema.safeParse(request.body);
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
        {
          userId,
          memberId: parsed.data.memberId ?? 'walk-in',
          action: 'pos_checkout',
        },
        'POS checkout',
      );

      try {
        const payment = await posCheckout(parsed.data, userId);
        return reply.status(201).send(ok({
          paymentId: payment.id,
          receiptNumber: payment.receiptNumber,
          totalAmount: payment.totalAmount,
          paidAmount: payment.paidAmount,
          remaining: payment.remaining,
        }));
      } catch (err) {
        if (handlePaymentError(err, reply)) return;
        if (err instanceof InventoryError) {
          reply.status(err.statusCode).send(fail(err.code, err.message));
          return;
        }
        throw err;
      }
    },
  );
}
