// Server-only loader shared by GET /api/access and the Access Panel page.

import { prisma } from "@/lib/prisma";
import {
  ROLE_RANK,
  STAFF_ROLES,
  canEditAccess,
  resolvePermissions,
  type Permission,
  type PermissionOverride,
  type Role,
} from "@/lib/permissions";

export type AccessUser = {
  id: number;
  name: string;
  email: string;
  employeeCode: string;
  role: Role;
  effective: Permission[];
  overrides: PermissionOverride[];
  editable: boolean;
};

export async function loadAccessUsers(actor: {
  role: Role;
  perms: Set<Permission>;
}): Promise<AccessUser[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: [...STAFF_ROLES] } },
    select: { id: true, name: true, email: true, employeeCode: true, role: true },
  });

  const rows = users.length
    ? await prisma.userPermission.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        select: { userId: true, module: true, action: true, granted: true },
      })
    : [];

  const byUser = new Map<number, PermissionOverride[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push({ module: r.module, action: r.action, granted: r.granted });
    byUser.set(r.userId, list);
  }

  return users
    .map((u) => {
      const role = u.role as Role;
      // SUPER_ADMIN ignores overrides, so don't report stale rows as overrides.
      const overrides = role === "SUPER_ADMIN" ? [] : byUser.get(u.id) ?? [];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        employeeCode: u.employeeCode,
        role,
        effective: Array.from(resolvePermissions(role, overrides)),
        overrides,
        editable: canEditAccess(actor.role, actor.perms, role),
      };
    })
    .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.name.localeCompare(b.name));
}
