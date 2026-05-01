import type { preHandlerHookHandler } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { fail } from '../../lib/response.js';
import { ROLE_PERMISSIONS } from './auth.types.js';

// ─── Short-lived in-memory cache (30s TTL) ─────────────────────────────────
// Keyed by roleId, stores a Set of "resource:action" strings.
const permissionCache = new Map<string, { permissions: Set<string>; expiry: number }>();
const CACHE_TTL_MS = 30_000;

/**
 * Invalidate the permission cache for a specific role.
 * Call this after role permissions are changed.
 */
export function invalidateRoleCache(roleId: string): void {
  permissionCache.delete(roleId);
}

/**
 * Invalidate the entire permission cache.
 */
export function invalidateAllRoleCache(): void {
  permissionCache.clear();
}

async function getPermissionsForRole(roleId: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = permissionCache.get(roleId);
  if (cached && cached.expiry > now) {
    return cached.permissions;
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  const permSet = new Set<string>();
  for (const rp of rolePermissions) {
    permSet.add(`${rp.permission.resource}:${rp.permission.action}`);
  }

  permissionCache.set(roleId, {
    permissions: permSet,
    expiry: now + CACHE_TTL_MS,
  });

  return permSet;
}

/**
 * Check if a role has a specific permission.
 * "manage" action implies all other actions on the same resource.
 */
function hasPermission(permissions: Set<string>, resource: string, action: string): boolean {
  if (permissions.has(`${resource}:${action}`)) return true;
  // "manage" implies view, create, edit, delete
  if (action !== 'manage' && permissions.has(`${resource}:manage`)) return true;
  return false;
}

/**
 * requirePermission('members', 'view') -- checks if the user's role has this
 * permission in the DB (or short-lived cache).
 *
 * Admin role always passes (superadmin bypass).
 * Falls back to static ROLE_PERMISSIONS if user has no roleId.
 */
export function requirePermission(resource: string, action: string): preHandlerHookHandler {
  return async (request, reply) => {
    if (!request.user) {
      reply.status(401).send(fail('UNAUTHENTICATED', 'Authentication required'));
      return;
    }

    // Admin bypass: always has all permissions
    if (request.user.role === 'admin') {
      return;
    }

    const roleId = request.user.roleId;

    if (roleId) {
      // Dynamic RBAC from database
      try {
        const permissions = await getPermissionsForRole(roleId);
        if (hasPermission(permissions, resource, action)) {
          return;
        }
      } catch (err) {
        request.log.error({ err, roleId, resource, action }, 'RBAC permission check failed');
        // On DB error, deny access rather than fail open
        reply.status(403).send(fail('FORBIDDEN', 'You do not have permission to perform this action'));
        return;
      }
    } else {
      // Fallback: static ROLE_PERMISSIONS for backward compatibility
      const staticPerms = ROLE_PERMISSIONS[request.user.role] ?? [];
      // Static permissions are coarse (resource-level only)
      if (staticPerms.includes(resource)) {
        return;
      }
    }

    reply.status(403).send(fail('FORBIDDEN', 'You do not have permission to perform this action'));
  };
}

/**
 * Get all dynamic permissions for a role as "resource:action" strings.
 * Used by /auth/me to return permissions.
 */
export async function getDynamicPermissions(roleId: string | null | undefined, role: string): Promise<string[]> {
  // Admin always gets all permissions
  if (role === 'admin') {
    const allPerms = await prisma.permission.findMany();
    return allPerms.map((p) => `${p.resource}:${p.action}`);
  }

  if (roleId) {
    const permissions = await getPermissionsForRole(roleId);
    return Array.from(permissions);
  }

  // Fallback to static permissions
  const staticPerms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [];
  return staticPerms.map((resource) => `${resource}:view`);
}
