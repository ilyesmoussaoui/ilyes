/**
 * Permission utility functions for the granular permission system.
 *
 * Permissions follow the pattern "resource:action" (e.g., "members:view").
 * The special action "manage" implies all actions on that resource.
 * The permission "settings:manage" implies all settings sub-permissions.
 */

/**
 * Check if a set of permissions includes a specific resource:action combination.
 *
 * Returns true when:
 * - `permissions` includes the exact string `"resource:action"`
 * - `permissions` includes `"resource:manage"` (manage implies all actions)
 * - `permissions` includes `"settings:manage"` and we are checking any
 *   settings-related permission (e.g. `"settings.users:view"`)
 */
export function hasPermission(
  permissions: string[],
  resource: string,
  action: string,
): boolean {
  // Exact match
  if (permissions.includes(`${resource}:${action}`)) return true;

  // "manage" on that resource implies every action
  if (permissions.includes(`${resource}:manage`)) return true;

  // "settings:manage" is a super-permission for anything settings-related
  if (
    resource.startsWith('settings') &&
    permissions.includes('settings:manage')
  ) {
    return true;
  }

  // Wildcard: if the user has "*:*" they can do anything (super admin fallback)
  if (permissions.includes('*:*')) return true;

  return false;
}

/**
 * Group an array of permission definitions by resource for display in a matrix.
 */
export interface PermissionDef {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface PermissionGroup {
  resource: string;
  permissions: PermissionDef[];
}

export function groupPermissions(
  permissions: PermissionDef[],
): PermissionGroup[] {
  const map = new Map<string, PermissionDef[]>();
  for (const perm of permissions) {
    const group = map.get(perm.resource);
    if (group) {
      group.push(perm);
    } else {
      map.set(perm.resource, [perm]);
    }
  }
  return Array.from(map.entries()).map(([resource, perms]) => ({
    resource,
    permissions: perms,
  }));
}

/**
 * Capitalizes a resource name for display (e.g., "members" -> "Members").
 */
export function resourceLabel(resource: string): string {
  return resource
    .split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
