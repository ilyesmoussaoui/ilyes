import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fail, ok } from '../../lib/response.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.middleware.js';
import {
  bulkUpdateSettingsSchema,
  createUserSchema,
  updateUserSchema,
  createRoleSchema,
  updateRoleSchema,
  createDisciplineSchema,
  updateDisciplineSchema,
  createPricingSchema,
  updatePricingSchema,
  bulkUpdateDocumentRequirementsSchema,
  bulkUpdateNotificationSettingsSchema,
  updateFeeSettingsSchema,
  uuidParamSchema,
} from './settings.types.js';
import {
  SettingsError,
  getSettings,
  bulkUpdateSettings,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  listDisciplines,
  createDiscipline,
  updateDiscipline,
  deleteDiscipline,
  listPricing,
  createPricing,
  updatePricing,
  deletePricing,
  listDocumentRequirements,
  bulkUpdateDocumentRequirements,
  listNotificationSettings,
  bulkUpdateNotificationSettings,
  getFeeSettings,
  updateFeeSettings,
} from './settings.service.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user) {
    reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
    return null;
  }
  return request.user.id;
}

function handleSettingsError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof SettingsError) {
    reply.status(err.statusCode).send(fail(err.code, err.message));
    return true;
  }
  return false;
}

// ─── Route plugin ───────────────────────────────────────────────────────────

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const canView = requirePermission('settings', 'view');
  const canManage = requirePermission('settings', 'manage');

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/',
    { preHandler: [requireAuth, canView] },
    async (_request, reply) => {
      try {
        const settings = await getSettings();
        return reply.send(ok({ settings }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = bulkUpdateSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, keys: Object.keys(parsed.data.settings), action: 'bulk_update_settings' },
        'Updating system settings',
      );

      try {
        const settings = await bulkUpdateSettings(parsed.data, userId);
        return reply.send(ok({ settings }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/users',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_users' },
        'Listing users',
      );

      try {
        const users = await listUsers();
        return reply.send(ok({ users }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.post(
    '/users',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, email: parsed.data.email, action: 'create_user' },
        'Creating user',
      );

      try {
        const user = await createUser(parsed.data, userId);
        return reply.status(201).send(ok({ user }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/users/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const operatorId = getUserId(request, reply);
      if (!operatorId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid user ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = updateUserSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { operatorId, targetUserId: paramsParsed.data.id, action: 'update_user' },
        'Updating user',
      );

      try {
        const user = await updateUser(paramsParsed.data.id, bodyParsed.data, operatorId);
        return reply.send(ok({ user }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.delete(
    '/users/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const operatorId = getUserId(request, reply);
      if (!operatorId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid user ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { operatorId, targetUserId: paramsParsed.data.id, action: 'delete_user' },
        'Deleting user',
      );

      try {
        await deleteUser(paramsParsed.data.id, operatorId);
        return reply.status(204).send();
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/roles',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_roles' },
        'Listing roles',
      );

      try {
        const roles = await listRoles();
        return reply.send(ok({ roles }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.get(
    '/roles/:id',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid role ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      try {
        const role = await getRoleById(paramsParsed.data.id);
        return reply.send(ok({ role }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.post(
    '/roles',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createRoleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, roleName: parsed.data.name, action: 'create_role' },
        'Creating role',
      );

      try {
        const role = await createRole(parsed.data, userId);
        return reply.status(201).send(ok({ role }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/roles/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid role ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = updateRoleSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, roleId: paramsParsed.data.id, action: 'update_role' },
        'Updating role',
      );

      try {
        const role = await updateRole(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.send(ok({ role }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.delete(
    '/roles/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid role ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, roleId: paramsParsed.data.id, action: 'delete_role' },
        'Deleting role',
      );

      try {
        await deleteRole(paramsParsed.data.id, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/permissions',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_permissions' },
        'Listing permissions',
      );

      try {
        const permissions = await listPermissions();
        return reply.send(ok({ permissions }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCIPLINE SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/disciplines',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_disciplines' },
        'Listing disciplines',
      );

      try {
        const disciplines = await listDisciplines();
        return reply.send(ok({ disciplines }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.post(
    '/disciplines',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createDisciplineSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, name: parsed.data.name, action: 'create_discipline' },
        'Creating discipline',
      );

      try {
        const discipline = await createDiscipline(parsed.data, userId);
        return reply.status(201).send(ok({ discipline }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/disciplines/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid discipline ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = updateDisciplineSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, disciplineId: paramsParsed.data.id, action: 'update_discipline' },
        'Updating discipline',
      );

      try {
        const discipline = await updateDiscipline(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.send(ok({ discipline }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.delete(
    '/disciplines/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid discipline ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, disciplineId: paramsParsed.data.id, action: 'delete_discipline' },
        'Deleting discipline',
      );

      try {
        await deleteDiscipline(paramsParsed.data.id, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PRICING SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/pricing',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_pricing' },
        'Listing pricing',
      );

      try {
        const pricing = await listPricing();
        return reply.send(ok({ pricing }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.post(
    '/pricing',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = createPricingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, disciplineId: parsed.data.disciplineId, planType: parsed.data.planType, action: 'create_pricing' },
        'Creating pricing plan',
      );

      try {
        const plan = await createPricing(parsed.data, userId);
        return reply.status(201).send(ok({ plan }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/pricing/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid plan ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      const bodyParsed = updatePricingSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', bodyParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, planId: paramsParsed.data.id, action: 'update_pricing' },
        'Updating pricing plan',
      );

      try {
        const plan = await updatePricing(paramsParsed.data.id, bodyParsed.data, userId);
        return reply.send(ok({ plan }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.delete(
    '/pricing/:id',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const paramsParsed = uuidParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid plan ID', paramsParsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, planId: paramsParsed.data.id, action: 'delete_pricing' },
        'Deleting pricing plan',
      );

      try {
        await deletePricing(paramsParsed.data.id, userId);
        return reply.status(204).send();
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/documents',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_document_requirements' },
        'Listing document requirements',
      );

      try {
        const requirements = await listDocumentRequirements();
        return reply.send(ok({ requirements }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/documents',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = bulkUpdateDocumentRequirementsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, count: parsed.data.requirements.length, action: 'bulk_update_document_requirements' },
        'Updating document requirements',
      );

      try {
        const requirements = await bulkUpdateDocumentRequirements(parsed.data, userId);
        return reply.send(ok({ requirements }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/notifications',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'list_notification_settings' },
        'Listing notification settings',
      );

      try {
        const settings = await listNotificationSettings();
        return reply.send(ok({ settings }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/notifications',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = bulkUpdateNotificationSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, count: parsed.data.settings.length, action: 'bulk_update_notification_settings' },
        'Updating notification settings',
      );

      try {
        const settings = await bulkUpdateNotificationSettings(parsed.data, userId);
        return reply.send(ok({ settings }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FEE SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get(
    '/fees',
    { preHandler: [requireAuth, canView] },
    async (request, reply) => {
      request.log.info(
        { userId: request.user?.id, action: 'get_fee_settings' },
        'Getting fee settings',
      );

      try {
        const fees = await getFeeSettings();
        return reply.send(ok({ fees }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );

  app.put(
    '/fees',
    { preHandler: [requireAuth, canManage] },
    async (request, reply) => {
      const userId = getUserId(request, reply);
      if (!userId) return;

      const parsed = updateFeeSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send(
            fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
          );
      }

      request.log.info(
        { userId, action: 'update_fee_settings' },
        'Updating fee settings',
      );

      try {
        const fees = await updateFeeSettings(parsed.data, userId);
        return reply.send(ok({ fees }));
      } catch (err) {
        if (handleSettingsError(err, reply)) return;
        throw err;
      }
    },
  );
}
