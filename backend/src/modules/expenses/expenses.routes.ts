import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  uuidParamSchema,
  summaryQuerySchema,
  receiptFileParamSchema,
} from './expenses.types.js';
import {
  ExpenseError,
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpensesSummary,
  uploadExpenseReceipt,
  getReceiptStream,
  ensureReceiptsDir,
} from './expenses.service.js';

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleExpenseError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof ExpenseError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function expensesRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requireRole('admin', 'manager', 'accountant');

  await ensureReceiptsDir();

  // ─── GET /expenses/summary — KPIs + category breakdown + MoM ──────────────
  app.get(
    '/summary',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = summaryQuerySchema.safeParse(request.query);
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

      try {
        const summary = await getExpensesSummary(parsed.data);
        return reply.send(ok({ summary }));
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /expenses — Create expense ───────────────────────────────────────
  app.post(
    '/',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createExpenseSchema.safeParse(request.body);
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
        { userId, category: parsed.data.category, action: 'create_expense' },
        'Creating expense',
      );

      try {
        const expense = await createExpense(parsed.data, userId);
        return reply.status(201).send(ok({ expense }));
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /expenses — List expenses ─────────────────────────────────────────
  app.get(
    '/',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = listExpensesQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'list_expenses' },
        'Listing expenses',
      );

      try {
        const result = await listExpenses(parsed.data);
        return reply.send(ok(result));
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /expenses/:id — Get single expense ───────────────────────────────
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
              'Invalid expense id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId: request.user?.id, expenseId: paramsParsed.data.id, action: 'get_expense' },
        'Getting expense',
      );

      try {
        const expense = await getExpenseById(paramsParsed.data.id);
        return reply.send(ok({ expense }));
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── PATCH /expenses/:id — Update expense ─────────────────────────────────
  app.patch(
    '/:id',
    { preHandler: [requireAuth, canAccess] },
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
              'Invalid expense id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      const bodyParsed = updateExpenseSchema.safeParse(request.body);
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
        { userId, expenseId: paramsParsed.data.id, action: 'update_expense' },
        'Updating expense',
      );

      try {
        const expense = await updateExpense(
          paramsParsed.data.id,
          bodyParsed.data,
          userId,
        );
        return reply.send(ok({ expense }));
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /expenses/:id — Soft delete expense ────────────────────────────
  app.delete(
    '/:id',
    { preHandler: [requireAuth, canAccess] },
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
              'Invalid expense id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      request.log.info(
        { userId, expenseId: paramsParsed.data.id, action: 'delete_expense' },
        'Deleting expense',
      );

      try {
        await deleteExpense(paramsParsed.data.id, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /expenses/:id/receipt — Upload receipt file ──────────────────────
  app.post(
    '/:id/receipt',
    { preHandler: [requireAuth, canAccess] },
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
              'Invalid expense id',
              paramsParsed.error.flatten().fieldErrors,
            ),
          );
      }

      if (!request.isMultipart()) {
        return reply
          .status(415)
          .send(fail('UNSUPPORTED_MEDIA_TYPE', 'Expected multipart/form-data'));
      }

      let fileBuffer: Buffer | null = null;
      let fileMimeType: string | null = null;

      const parts = request.parts({
        limits: { fileSize: RECEIPT_MAX_BYTES, files: 1, fields: 5 },
      });

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            await part.toBuffer();
            continue;
          }
          fileMimeType = part.mimetype;
          try {
            fileBuffer = await part.toBuffer();
          } catch (err: unknown) {
            const e = err as { code?: string };
            if (e && e.code === 'FST_REQ_FILE_TOO_LARGE') {
              return reply
                .status(413)
                .send(fail('PAYLOAD_TOO_LARGE', 'Receipt exceeds 5MB limit'));
            }
            throw err;
          }
          if (part.file.truncated) {
            return reply
              .status(413)
              .send(fail('PAYLOAD_TOO_LARGE', 'Receipt exceeds 5MB limit'));
          }
        }
      }

      if (!fileBuffer || !fileMimeType) {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'Missing "file" field'));
      }

      try {
        const result = await uploadExpenseReceipt({
          expenseId: paramsParsed.data.id,
          mimeType: fileMimeType,
          bytes: fileBuffer,
          userId,
        });
        return reply.send(ok(result));
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /expenses/receipts/:filename — Serve receipt file ─────────────────
  app.get(
    '/receipts/:filename',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = receiptFileParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(fail('VALIDATION_ERROR', 'Invalid filename'));
      }

      try {
        const result = await getReceiptStream(parsed.data.filename);
        reply.header('Content-Type', result.contentType);
        reply.header('Content-Length', result.size);
        reply.header('Cache-Control', 'private, max-age=300');
        return reply.send(result.stream);
      } catch (err) {
        if (handleExpenseError(err, reply)) return;
        throw err;
      }
    },
  );
}
