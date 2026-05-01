import type { DocumentType, NotificationType, PlanType, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { diffToAuditEntries, insertAuditEntries } from '../../lib/audit.js';
import { hashPassword } from '../auth/auth.service.js';
import { invalidateRoleCache } from '../auth/rbac.middleware.js';
import type {
  BulkUpdateSettingsInput,
  CreateUserInput,
  UpdateUserInput,
  CreateRoleInput,
  UpdateRoleInput,
  CreateDisciplineInput,
  UpdateDisciplineInput,
  CreatePricingInput,
  UpdatePricingInput,
  BulkUpdateDocumentRequirementsInput,
  BulkUpdateNotificationSettingsInput,
} from './settings.types.js';

// ─── Error class ────────────────────────────────────────────────────────────

export class SettingsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SettingsError';
  }
}

// ─── System settings ────────────────────────────────────────────────────────

export type SettingsPayload = Record<string, string | number> & {
  registrationFee: number;
  licenseFee: number;
  extraSessionPrice: number;
};

function parseFeesFromMap(map: Record<string, string>): Pick<SettingsPayload, 'registrationFee' | 'licenseFee' | 'extraSessionPrice'> {
  const parse = (key: string, fallback: number) => {
    const raw = map[key];
    if (raw === undefined) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };
  return {
    registrationFee: parse('registrationFee', 50000),
    licenseFee: parse('licenseFee', 120000),
    extraSessionPrice: parse('extraSessionPrice', 75000),
  };
}

export async function getSettings(): Promise<SettingsPayload> {
  const settings = await prisma.setting.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  const fees = parseFeesFromMap(result);
  return { ...result, ...fees } as SettingsPayload;
}

/** Read only the three fee values — used by billing without fetching all settings */
export async function getFees(): Promise<{ registrationFee: number; licenseFee: number; extraSessionPrice: number }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['registrationFee', 'licenseFee', 'extraSessionPrice'] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return parseFeesFromMap(map);
}

/** GET /settings/fees — returns the three configurable fee values */
export async function getFeeSettings(): Promise<{ registrationFee: number; licenseFee: number; extraSessionPrice: number }> {
  return getFees();
}

/** PUT /settings/fees — update one or more fee values */
export async function updateFeeSettings(
  input: import('./settings.types.js').UpdateFeeSettingsInput,
  userId: string,
): Promise<{ registrationFee: number; licenseFee: number; extraSessionPrice: number }> {
  const entries: Array<{ key: string; value: string }> = [];
  if (input.registrationFee !== undefined) entries.push({ key: 'registrationFee', value: String(input.registrationFee) });
  if (input.licenseFee !== undefined) entries.push({ key: 'licenseFee', value: String(input.licenseFee) });
  if (input.extraSessionPrice !== undefined) entries.push({ key: 'extraSessionPrice', value: String(input.extraSessionPrice) });

  await prisma.$transaction(async (tx) => {
    for (const { key, value } of entries) {
      await tx.setting.upsert({
        where: { key },
        update: { value, updatedBy: userId },
        create: { key, value, updatedBy: userId },
      });
    }
  });

  return getFees();
}

export async function bulkUpdateSettings(
  input: BulkUpdateSettingsInput,
  userId: string,
): Promise<SettingsPayload> {
  return prisma.$transaction(async (tx) => {
    const entries = Object.entries(input.settings);
    const auditEntries: Parameters<typeof insertAuditEntries>[1] = [];

    // Values that are sensitive or too large (logos) should not be audited
    // verbatim — log a redacted placeholder instead.
    const REDACTED_KEYS = new Set(['club_logo']);
    const redact = (k: string, v: string | null): string | null => {
      if (v == null) return v;
      if (REDACTED_KEYS.has(k)) return `[${v.length} chars]`;
      return v;
    };

    for (const [key, value] of entries) {
      if (value === undefined) continue;

      const existing = await tx.setting.findUnique({ where: { key } });

      if (existing) {
        if (existing.value !== value) {
          auditEntries.push({
            tableName: 'settings',
            recordId: existing.id,
            fieldName: key,
            oldValue: redact(key, existing.value),
            newValue: redact(key, value),
            userId,
            reason: 'Settings updated',
          });
        }
        await tx.setting.update({
          where: { key },
          data: { value, updatedBy: userId },
        });
      } else {
        const created = await tx.setting.create({
          data: { key, value, updatedBy: userId },
        });
        auditEntries.push({
          tableName: 'settings',
          recordId: created.id,
          fieldName: key,
          oldValue: null,
          newValue: redact(key, value),
          userId,
          reason: 'Setting created',
        });
      }
    }

    await insertAuditEntries(tx, auditEntries);

    const allSettings = await tx.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of allSettings) {
      result[s.key] = s.value;
    }
    const fees = parseFeesFromMap(result);
    return { ...result, ...fees } as SettingsPayload;
  });
}

// ─── User management ────────────────────────────────────────────────────────

export async function listUsers() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      role: true,
      roleId: true,
      fullNameLatin: true,
      fullNameArabic: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      dynamicRole: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    roleId: u.roleId,
    fullNameLatin: u.fullNameLatin,
    fullNameArabic: u.fullNameArabic,
    isActive: u.isActive,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    roleName: u.dynamicRole?.name ?? u.role,
  }));
}

export async function createUser(input: CreateUserInput, creatorId: string) {
  // Check email uniqueness
  const existing = await prisma.user.findFirst({
    where: { email: input.email.trim().toLowerCase(), deletedAt: null },
  });
  if (existing) {
    throw new SettingsError('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
  }

  // Validate roleId
  const role = await prisma.role.findFirst({
    where: { id: input.roleId, deletedAt: null, isActive: true },
  });
  if (!role) {
    throw new SettingsError('INVALID_ROLE', 'The specified role does not exist or is inactive', 404);
  }

  // Map role name to UserRole enum for backward compatibility
  const roleEnumValue = mapRoleNameToEnum(role.name);

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      passwordHash,
      role: roleEnumValue,
      roleId: input.roleId,
      fullNameLatin: input.fullNameLatin,
      fullNameArabic: input.fullNameArabic ?? null,
      isActive: true,
      createdBy: creatorId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      roleId: true,
      fullNameLatin: true,
      fullNameArabic: true,
      isActive: true,
      createdAt: true,
    },
  });

  return user;
}

export async function updateUser(userId: string, input: UpdateUserInput, operatorId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new SettingsError('NOT_FOUND', 'User not found', 404);
  }

  // Check if deactivating last active admin
  if (input.isActive === false && user.role === 'admin') {
    const activeAdminCount = await prisma.user.count({
      where: { role: 'admin', isActive: true, deletedAt: null },
    });
    if (activeAdminCount <= 1) {
      throw new SettingsError('LAST_ADMIN', 'Cannot deactivate the last active admin', 400);
    }
  }

  // If changing role, check last admin constraint
  if (input.roleId && user.role === 'admin') {
    const newRole = await prisma.role.findFirst({
      where: { id: input.roleId, deletedAt: null },
    });
    if (newRole && newRole.name !== 'admin') {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'admin', isActive: true, deletedAt: null },
      });
      if (activeAdminCount <= 1) {
        throw new SettingsError('LAST_ADMIN', 'Cannot change the role of the last active admin', 400);
      }
    }
  }

  // Check email uniqueness if changing
  if (input.email) {
    const emailNorm = input.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: emailNorm, deletedAt: null, NOT: { id: userId } },
    });
    if (existing) {
      throw new SettingsError('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
    }
  }

  // Validate roleId if provided
  let roleEnumValue: UserRole | undefined;
  if (input.roleId) {
    const role = await prisma.role.findFirst({
      where: { id: input.roleId, deletedAt: null, isActive: true },
    });
    if (!role) {
      throw new SettingsError('INVALID_ROLE', 'The specified role does not exist or is inactive', 404);
    }
    roleEnumValue = mapRoleNameToEnum(role.name);
  }

  const updateData: Record<string, unknown> = {
    updatedBy: operatorId,
  };
  if (input.fullNameLatin !== undefined) updateData.fullNameLatin = input.fullNameLatin;
  if (input.fullNameArabic !== undefined) updateData.fullNameArabic = input.fullNameArabic;
  if (input.email !== undefined) updateData.email = input.email.trim().toLowerCase();
  if (input.roleId !== undefined) {
    updateData.roleId = input.roleId;
    if (roleEnumValue) updateData.role = roleEnumValue;
  }
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.password) {
    updateData.passwordHash = await hashPassword(input.password);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        roleId: true,
        fullNameLatin: true,
        fullNameArabic: true,
        isActive: true,
        createdAt: true,
        dynamicRole: { select: { id: true, name: true } },
      },
    });

    // Audit trail
    const auditData: Record<string, unknown> = {};
    if (input.fullNameLatin !== undefined) auditData.fullNameLatin = input.fullNameLatin;
    if (input.fullNameArabic !== undefined) auditData.fullNameArabic = input.fullNameArabic;
    if (input.email !== undefined) auditData.email = input.email;
    if (input.roleId !== undefined) auditData.roleId = input.roleId;
    if (input.isActive !== undefined) auditData.isActive = input.isActive;
    if (input.password) auditData.passwordHash = '***';

    const oldData: Record<string, unknown> = {
      fullNameLatin: user.fullNameLatin,
      fullNameArabic: user.fullNameArabic,
      email: user.email,
      roleId: user.roleId,
      isActive: user.isActive,
    };
    if (input.password) oldData.passwordHash = '***';

    const entries = diffToAuditEntries('users', userId, oldData, auditData, operatorId, 'User updated');
    await insertAuditEntries(tx, entries);

    return updated;
  });
}

export async function deleteUser(userId: string, operatorId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new SettingsError('NOT_FOUND', 'User not found', 404);
  }

  // Cannot delete last active admin
  if (user.role === 'admin' && user.isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: 'admin', isActive: true, deletedAt: null },
    });
    if (activeAdminCount <= 1) {
      throw new SettingsError('LAST_ADMIN', 'Cannot delete the last active admin', 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false, updatedBy: operatorId },
    });

    await insertAuditEntries(tx, [{
      tableName: 'users',
      recordId: userId,
      fieldName: 'deletedAt',
      oldValue: null,
      newValue: new Date().toISOString(),
      userId: operatorId,
      reason: 'User soft-deleted',
    }]);
  });
}

// ─── Role management ────────────────────────────────────────────────────────

export async function listRoles() {
  const roles = await prisma.role.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: { users: { where: { deletedAt: null } } },
      },
      permissions: {
        include: { permission: true },
      },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    isActive: r.isActive,
    userCount: r._count.users,
    permissions: r.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
  }));
}

export async function getRoleById(roleId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, deletedAt: null },
    include: {
      _count: {
        select: { users: { where: { deletedAt: null } } },
      },
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!role) {
    throw new SettingsError('NOT_FOUND', 'Role not found', 404);
  }

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    userCount: role._count.users,
    permissions: role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
  };
}

export async function createRole(input: CreateRoleInput, userId: string) {
  // Check name uniqueness
  const existing = await prisma.role.findFirst({
    where: { name: input.name, deletedAt: null },
  });
  if (existing) {
    throw new SettingsError('DUPLICATE_NAME', 'A role with this name already exists', 409);
  }

  // Resolve permission IDs
  const permissionIds = await resolvePermissionIds(input.permissions);

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
        isActive: true,
      },
    });

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((pid) => ({
          roleId: role.id,
          permissionId: pid,
        })),
      });
    }

    await insertAuditEntries(tx, [{
      tableName: 'roles',
      recordId: role.id,
      fieldName: 'created',
      oldValue: null,
      newValue: role.name,
      userId,
      reason: 'Custom role created',
    }]);

    return getRoleByIdFromTx(tx, role.id);
  });
}

export async function updateRole(roleId: string, input: UpdateRoleInput, userId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, deletedAt: null },
  });
  if (!role) {
    throw new SettingsError('NOT_FOUND', 'Role not found', 404);
  }

  // Cannot rename system roles
  if (role.isSystem && input.name && input.name !== role.name) {
    throw new SettingsError('SYSTEM_ROLE', 'Cannot rename system roles', 400);
  }

  // Cannot modify admin role permissions
  if (role.name === 'admin' && input.permissions) {
    throw new SettingsError('ADMIN_ROLE', 'Cannot modify admin role permissions', 400);
  }

  return prisma.$transaction(async (tx) => {
    // Update role metadata
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined && !role.isSystem) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    if (Object.keys(updateData).length > 0) {
      await tx.role.update({
        where: { id: roleId },
        data: updateData,
      });
    }

    // Update permissions if provided
    if (input.permissions !== undefined) {
      const permissionIds = await resolvePermissionIdsFromTx(tx, input.permissions);

      // Delete existing permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Create new permissions
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((pid) => ({
            roleId,
            permissionId: pid,
          })),
        });
      }

      // Invalidate cache for this role
      invalidateRoleCache(roleId);
    }

    await insertAuditEntries(tx, [{
      tableName: 'roles',
      recordId: roleId,
      fieldName: 'permissions',
      oldValue: null,
      newValue: JSON.stringify(input.permissions ?? input.name ?? input.description),
      userId,
      reason: 'Role updated',
    }]);

    return getRoleByIdFromTx(tx, roleId);
  });
}

export async function deleteRole(roleId: string, userId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, deletedAt: null },
  });
  if (!role) {
    throw new SettingsError('NOT_FOUND', 'Role not found', 404);
  }

  if (role.isSystem) {
    throw new SettingsError('SYSTEM_ROLE', 'Cannot delete system roles', 400);
  }

  // Check if any active users are assigned this role
  const userCount = await prisma.user.count({
    where: { roleId, deletedAt: null },
  });
  if (userCount > 0) {
    throw new SettingsError('ROLE_IN_USE', `Cannot delete role: ${userCount} user(s) are assigned to it`, 400);
  }

  return prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: roleId },
      data: { deletedAt: new Date() },
    });

    invalidateRoleCache(roleId);

    await insertAuditEntries(tx, [{
      tableName: 'roles',
      recordId: roleId,
      fieldName: 'deletedAt',
      oldValue: null,
      newValue: new Date().toISOString(),
      userId,
      reason: 'Role soft-deleted',
    }]);
  });
}

// ─── Permissions ────────────────────────────────────────────────────────────

export async function listPermissions() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
  });

  // Group by resource
  const grouped: Record<string, Array<{ id: string; action: string; description: string | null }>> = {};
  for (const p of permissions) {
    if (!grouped[p.resource]) {
      grouped[p.resource] = [];
    }
    grouped[p.resource].push({
      id: p.id,
      action: p.action,
      description: p.description,
    });
  }
  return grouped;
}

// ─── Discipline settings ────────────────────────────────────────────────────

export async function listDisciplines() {
  const disciplines = await prisma.discipline.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          memberDisciplines: {
            where: { status: 'active', deletedAt: null },
          },
        },
      },
    },
  });

  return disciplines.map((d) => ({
    id: d.id,
    name: d.name,
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    activeEnrollments: d._count.memberDisciplines,
  }));
}

export async function createDiscipline(input: CreateDisciplineInput, userId: string) {
  const existing = await prisma.discipline.findFirst({
    where: { name: input.name, deletedAt: null },
  });
  if (existing) {
    throw new SettingsError('DUPLICATE_NAME', 'A discipline with this name already exists', 409);
  }

  return prisma.$transaction(async (tx) => {
    const discipline = await tx.discipline.create({
      data: {
        name: input.name,
        isActive: true,
      },
    });

    await insertAuditEntries(tx, [{
      tableName: 'disciplines',
      recordId: discipline.id,
      fieldName: 'created',
      oldValue: null,
      newValue: discipline.name,
      userId,
      reason: 'Discipline created',
    }]);

    return discipline;
  });
}

export async function updateDiscipline(disciplineId: string, input: UpdateDisciplineInput, userId: string) {
  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, deletedAt: null },
  });
  if (!discipline) {
    throw new SettingsError('NOT_FOUND', 'Discipline not found', 404);
  }

  if (input.name) {
    const existing = await prisma.discipline.findFirst({
      where: { name: input.name, deletedAt: null, NOT: { id: disciplineId } },
    });
    if (existing) {
      throw new SettingsError('DUPLICATE_NAME', 'A discipline with this name already exists', 409);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const updated = await tx.discipline.update({
      where: { id: disciplineId },
      data: updateData,
    });

    const entries = diffToAuditEntries(
      'disciplines',
      disciplineId,
      { name: discipline.name, isActive: discipline.isActive },
      { name: input.name ?? discipline.name, isActive: input.isActive ?? discipline.isActive },
      userId,
      'Discipline updated',
    );
    await insertAuditEntries(tx, entries);

    return updated;
  });
}

export async function deleteDiscipline(disciplineId: string, userId: string) {
  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, deletedAt: null },
  });
  if (!discipline) {
    throw new SettingsError('NOT_FOUND', 'Discipline not found', 404);
  }

  // Check for active enrollments
  const activeEnrollments = await prisma.memberDiscipline.count({
    where: {
      disciplineId,
      status: 'active',
      deletedAt: null,
    },
  });
  if (activeEnrollments > 0) {
    throw new SettingsError(
      'DISCIPLINE_IN_USE',
      `Cannot delete discipline: ${activeEnrollments} active enrollment(s) exist`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.discipline.update({
      where: { id: disciplineId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await insertAuditEntries(tx, [{
      tableName: 'disciplines',
      recordId: disciplineId,
      fieldName: 'deletedAt',
      oldValue: null,
      newValue: new Date().toISOString(),
      userId,
      reason: 'Discipline soft-deleted',
    }]);
  });
}

// ─── Pricing settings ───────────────────────────────────────────────────────

export async function listPricing() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { deletedAt: null },
    include: {
      discipline: { select: { id: true, name: true } },
    },
    orderBy: [{ discipline: { name: 'asc' } }, { planType: 'asc' }],
  });

  // Group by discipline
  const grouped: Record<string, {
    disciplineId: string;
    disciplineName: string;
    plans: Array<{ id: string; planType: string; amount: number; isActive: boolean }>;
  }> = {};

  for (const p of plans) {
    const key = p.disciplineId;
    if (!grouped[key]) {
      grouped[key] = {
        disciplineId: p.disciplineId,
        disciplineName: p.discipline.name,
        plans: [],
      };
    }
    grouped[key].plans.push({
      id: p.id,
      planType: p.planType,
      amount: p.amount,
      isActive: p.isActive,
    });
  }

  return Object.values(grouped);
}

export async function createPricing(input: CreatePricingInput, userId: string) {
  // Verify discipline exists
  const discipline = await prisma.discipline.findFirst({
    where: { id: input.disciplineId, deletedAt: null },
  });
  if (!discipline) {
    throw new SettingsError('NOT_FOUND', 'Discipline not found', 404);
  }

  // Check for duplicate
  const existing = await prisma.subscriptionPlan.findFirst({
    where: {
      disciplineId: input.disciplineId,
      planType: input.planType as PlanType,
      deletedAt: null,
    },
  });
  if (existing) {
    throw new SettingsError('DUPLICATE_PLAN', 'A plan with this type already exists for this discipline', 409);
  }

  return prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.create({
      data: {
        disciplineId: input.disciplineId,
        planType: input.planType as PlanType,
        amount: input.amount,
        isActive: true,
      },
      include: {
        discipline: { select: { id: true, name: true } },
      },
    });

    await insertAuditEntries(tx, [{
      tableName: 'subscription_plans',
      recordId: plan.id,
      fieldName: 'created',
      oldValue: null,
      newValue: `${plan.discipline.name} - ${plan.planType}: ${plan.amount}`,
      userId,
      reason: 'Subscription plan created',
    }]);

    return plan;
  });
}

export async function updatePricing(planId: string, input: UpdatePricingInput, userId: string) {
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id: planId, deletedAt: null },
  });
  if (!plan) {
    throw new SettingsError('NOT_FOUND', 'Subscription plan not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const updated = await tx.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
      include: {
        discipline: { select: { id: true, name: true } },
      },
    });

    const entries = diffToAuditEntries(
      'subscription_plans',
      planId,
      { amount: plan.amount, isActive: plan.isActive },
      { amount: input.amount ?? plan.amount, isActive: input.isActive ?? plan.isActive },
      userId,
      'Subscription plan updated',
    );
    await insertAuditEntries(tx, entries);

    return updated;
  });
}

export async function deletePricing(planId: string, userId: string) {
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id: planId, deletedAt: null },
  });
  if (!plan) {
    throw new SettingsError('NOT_FOUND', 'Subscription plan not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    await tx.subscriptionPlan.update({
      where: { id: planId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await insertAuditEntries(tx, [{
      tableName: 'subscription_plans',
      recordId: planId,
      fieldName: 'deletedAt',
      oldValue: null,
      newValue: new Date().toISOString(),
      userId,
      reason: 'Subscription plan soft-deleted',
    }]);
  });
}

// ─── Document settings ──────────────────────────────────────────────────────

const DOCUMENT_TYPE_DEFAULTS: Array<{
  documentType: DocumentType;
  isRequired: boolean;
  memberTypes: string[];
  validityMonths: number | null;
}> = [
  { documentType: 'id_card', isRequired: true, memberTypes: ['athlete', 'staff'], validityMonths: null },
  { documentType: 'medical_certificate', isRequired: true, memberTypes: ['athlete'], validityMonths: 12 },
  { documentType: 'photo', isRequired: true, memberTypes: ['athlete', 'staff'], validityMonths: null },
  { documentType: 'birth_certificate', isRequired: false, memberTypes: ['athlete'], validityMonths: null },
  { documentType: 'insurance', isRequired: false, memberTypes: ['athlete'], validityMonths: 12 },
  { documentType: 'parental_authorization', isRequired: false, memberTypes: ['athlete'], validityMonths: 12 },
  { documentType: 'belt_certificate', isRequired: false, memberTypes: ['athlete'], validityMonths: null },
  { documentType: 'other', isRequired: false, memberTypes: [], validityMonths: null },
];

export async function listDocumentRequirements() {
  let requirements = await prisma.documentRequirement.findMany({
    orderBy: { documentType: 'asc' },
  });

  // Auto-seed defaults for any DocumentType enum value that isn't configured
  // yet. This keeps the Settings → Documents screen operable on fresh
  // installs and after adding new enum values via migration.
  const existingTypes = new Set(requirements.map((r) => r.documentType));
  const missing = DOCUMENT_TYPE_DEFAULTS.filter((d) => !existingTypes.has(d.documentType));

  if (missing.length > 0) {
    await prisma.documentRequirement.createMany({
      data: missing.map((d) => ({
        documentType: d.documentType,
        isRequired: d.isRequired,
        memberTypes: d.memberTypes,
        validityMonths: d.validityMonths,
      })),
      skipDuplicates: true,
    });
    requirements = await prisma.documentRequirement.findMany({
      orderBy: { documentType: 'asc' },
    });
  }

  return requirements.map((r) => ({
    id: r.id,
    documentType: r.documentType,
    isRequired: r.isRequired,
    memberTypes: r.memberTypes,
    validityMonths: r.validityMonths,
  }));
}

export async function bulkUpdateDocumentRequirements(
  input: BulkUpdateDocumentRequirementsInput,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    for (const req of input.requirements) {
      await tx.documentRequirement.upsert({
        where: { documentType: req.documentType as DocumentType },
        update: {
          isRequired: req.isRequired,
          memberTypes: req.memberTypes,
          validityMonths: req.validityMonths ?? null,
        },
        create: {
          documentType: req.documentType as DocumentType,
          isRequired: req.isRequired,
          memberTypes: req.memberTypes,
          validityMonths: req.validityMonths ?? null,
        },
      });
    }

    await insertAuditEntries(tx, [{
      tableName: 'document_requirements',
      recordId: '00000000-0000-0000-0000-000000000000',
      fieldName: 'bulk_update',
      oldValue: null,
      newValue: `Updated ${input.requirements.length} requirements`,
      userId,
      reason: 'Document requirements bulk updated',
    }]);

    return listDocumentRequirementsFromTx(tx);
  });
}

// ─── Notification settings ──────────────────────────────────────────────────

const NOTIFICATION_DEFAULTS: {
  type: NotificationType;
  isEnabled: boolean;
  daysBefore: number | null;
  template: string | null;
}[] = [
  {
    type: 'subscription_expiring',
    isEnabled: true,
    daysBefore: 7,
    template: 'Your subscription expires in {daysLeft} days. Please renew to avoid interruption.',
  },
  {
    type: 'payment_due',
    isEnabled: true,
    daysBefore: 3,
    template: 'You have an outstanding balance of {amount} DZD. Receipt: {receiptNumber}.',
  },
  {
    type: 'document_expiring',
    isEnabled: true,
    daysBefore: 14,
    template: 'Your {documentType} expires in {daysLeft} days. Please renew soon.',
  },
  {
    type: 'birthday',
    isEnabled: true,
    daysBefore: 0,
    template: 'Wishing {memberName} a very happy birthday from all of us at the club!',
  },
  {
    type: 'general',
    isEnabled: true,
    daysBefore: null,
    template: null,
  },
];

export async function listNotificationSettings() {
  const existing = await prisma.notificationSetting.findMany({
    orderBy: { type: 'asc' },
  });

  const missing = NOTIFICATION_DEFAULTS.filter(
    (d) => !existing.some((e) => e.type === d.type),
  );
  if (missing.length > 0) {
    await prisma.notificationSetting.createMany({
      data: missing,
      skipDuplicates: true,
    });
  }

  const settings =
    missing.length > 0
      ? await prisma.notificationSetting.findMany({ orderBy: { type: 'asc' } })
      : existing;

  return settings.map((s) => ({
    id: s.id,
    type: s.type,
    isEnabled: s.isEnabled,
    daysBefore: s.daysBefore,
    template: s.template,
  }));
}

export async function bulkUpdateNotificationSettings(
  input: BulkUpdateNotificationSettingsInput,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    for (const setting of input.settings) {
      await tx.notificationSetting.upsert({
        where: { type: setting.type as NotificationType },
        update: {
          isEnabled: setting.isEnabled,
          daysBefore: setting.daysBefore ?? null,
          template: setting.template ?? null,
        },
        create: {
          type: setting.type as NotificationType,
          isEnabled: setting.isEnabled,
          daysBefore: setting.daysBefore ?? null,
          template: setting.template ?? null,
        },
      });
    }

    await insertAuditEntries(tx, [{
      tableName: 'notification_settings',
      recordId: '00000000-0000-0000-0000-000000000000',
      fieldName: 'bulk_update',
      oldValue: null,
      newValue: `Updated ${input.settings.length} notification settings`,
      userId,
      reason: 'Notification settings bulk updated',
    }]);

    return listNotificationSettingsFromTx(tx);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapRoleNameToEnum(roleName: string): UserRole {
  const mapping: Record<string, UserRole> = {
    admin: 'admin',
    manager: 'manager',
    receptionist: 'receptionist',
    coach: 'coach',
    accountant: 'accountant',
  };
  // For custom roles, default to receptionist (lowest privilege system role)
  return mapping[roleName] ?? 'receptionist';
}

async function resolvePermissionIds(permStrings: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const perm of permStrings) {
    const [resource, action] = perm.split(':');
    if (!resource || !action) continue;
    const p = await prisma.permission.findFirst({
      where: { resource, action },
    });
    if (p) ids.push(p.id);
  }
  return ids;
}

async function resolvePermissionIdsFromTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  permStrings: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const perm of permStrings) {
    const [resource, action] = perm.split(':');
    if (!resource || !action) continue;
    const p = await tx.permission.findFirst({
      where: { resource, action },
    });
    if (p) ids.push(p.id);
  }
  return ids;
}

async function getRoleByIdFromTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  roleId: string,
) {
  const role = await tx.role.findFirst({
    where: { id: roleId, deletedAt: null },
    include: {
      _count: {
        select: { users: { where: { deletedAt: null } } },
      },
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!role) return null;

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    userCount: role._count.users,
    permissions: role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
  };
}

async function listDocumentRequirementsFromTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  const requirements = await tx.documentRequirement.findMany({
    orderBy: { documentType: 'asc' },
  });
  return requirements.map((r) => ({
    id: r.id,
    documentType: r.documentType,
    isRequired: r.isRequired,
    memberTypes: r.memberTypes,
    validityMonths: r.validityMonths,
  }));
}

async function listNotificationSettingsFromTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  const settings = await tx.notificationSetting.findMany({
    orderBy: { type: 'asc' },
  });
  return settings.map((s) => ({
    id: s.id,
    type: s.type,
    isEnabled: s.isEnabled,
    daysBefore: s.daysBefore,
    template: s.template,
  }));
}
