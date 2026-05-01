import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import {
  attendanceReportQuerySchema,
  financialReportQuerySchema,
  membershipReportQuerySchema,
  inventoryReportQuerySchema,
  documentReportQuerySchema,
  customReportQuerySchema,
  exportQuerySchema,
  saveTemplateSchema,
  outstandingBalancesQuerySchema,
  dailyCashQuerySchema,
  missingDocumentsQuerySchema,
  absencesQuerySchema,
  lateArrivalsQuerySchema,
} from './reports.types.js';
import {
  ReportError,
  getAttendanceReport,
  getFinancialReport,
  getMembershipReport,
  getInventoryReport,
  getDocumentReport,
  getCustomReport,
  exportReport,
  saveTemplate,
  listTemplates,
  deleteTemplate,
  getOutstandingBalances,
  getDailyCashReport,
  getMissingDocumentsReport,
  getAbsencesReport,
  getLateArrivalsReport,
} from './reports.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleReportError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof ReportError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  const canAccess = requireRole('admin', 'manager', 'accountant');

  // ─── GET /reports/attendance ───────────────────────────────────────────────
  app.get(
    '/attendance',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = attendanceReportQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'get_attendance_report' },
        'Generating attendance report',
      );

      try {
        const report = await getAttendanceReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/financial ────────────────────────────────────────────────
  app.get(
    '/financial',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = financialReportQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'get_financial_report' },
        'Generating financial report',
      );

      try {
        const report = await getFinancialReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/membership ───────────────────────────────────────────────
  app.get(
    '/membership',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = membershipReportQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'get_membership_report' },
        'Generating membership report',
      );

      try {
        const report = await getMembershipReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/inventory ────────────────────────────────────────────────
  app.get(
    '/inventory',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = inventoryReportQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'get_inventory_report' },
        'Generating inventory report',
      );

      try {
        const report = await getInventoryReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/documents ────────────────────────────────────────────────
  app.get(
    '/documents',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = documentReportQuerySchema.safeParse(request.query);
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
        { userId: request.user?.id, action: 'get_document_report' },
        'Generating document report',
      );

      try {
        const report = await getDocumentReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /reports/custom ──────────────────────────────────────────────────
  app.post(
    '/custom',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = customReportQuerySchema.safeParse(request.body);
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
        { userId: request.user?.id, action: 'get_custom_report', metrics: parsed.data.metrics },
        'Generating custom report',
      );

      try {
        const report = await getCustomReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/export ───────────────────────────────────────────────────
  app.get(
    '/export',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = exportQuerySchema.safeParse(request.query);
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
        {
          userId: request.user?.id,
          action: 'export_report',
          reportType: parsed.data.reportType,
          format: parsed.data.format,
        },
        'Exporting report',
      );

      try {
        const exportData = await exportReport(parsed.data);
        return reply.send(ok(exportData));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/outstanding-balances ─────────────────────────────────────
  app.get(
    '/outstanding-balances',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = outstandingBalancesQuerySchema.safeParse(request.query);
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
        const report = await getOutstandingBalances(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/daily-cash ───────────────────────────────────────────────
  app.get(
    '/daily-cash',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = dailyCashQuerySchema.safeParse(request.query);
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
        const report = await getDailyCashReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/missing-documents ────────────────────────────────────────
  app.get(
    '/missing-documents',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = missingDocumentsQuerySchema.safeParse(request.query);
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
        const report = await getMissingDocumentsReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/absences ─────────────────────────────────────────────────
  app.get(
    '/absences',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = absencesQuerySchema.safeParse(request.query);
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
        const report = await getAbsencesReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/late-arrivals ────────────────────────────────────────────
  app.get(
    '/late-arrivals',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const parsed = lateArrivalsQuerySchema.safeParse(request.query);
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
        const report = await getLateArrivalsReport(parsed.data);
        return reply.send(ok(report));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── POST /reports/templates ───────────────────────────────────────────────
  app.post(
    '/templates',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = saveTemplateSchema.safeParse(request.body);
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
        { userId, action: 'save_report_template', name: parsed.data.name },
        'Saving report template',
      );

      try {
        const template = await saveTemplate(parsed.data, userId);
        return reply.status(201).send(ok(template));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── GET /reports/templates ────────────────────────────────────────────────
  app.get(
    '/templates',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_report_templates' },
        'Listing report templates',
      );

      try {
        const templates = await listTemplates();
        return reply.send(ok(templates));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );

  // ─── DELETE /reports/templates/:id ──────────────────────────────────────────
  app.delete(
    '/templates/:id',
    { preHandler: [requireAuth, canAccess] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      request.log.info(
        { userId: request.user?.id, action: 'delete_report_template', templateId: id },
        'Deleting report template',
      );

      try {
        await deleteTemplate(id);
        return reply.send(ok({ deleted: true }));
      } catch (err) {
        if (handleReportError(err, reply)) return;
        throw err;
      }
    },
  );
}
