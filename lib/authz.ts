// Server-only authorization helpers. Resolves permissions fresh from the DB
// on every call (never trusts the JWT for anything beyond the coarse
// middleware gate) so Access Panel changes apply immediately.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePermissions, type Permission, type Role } from "@/lib/permissions";
import type { SessionUser } from "@/lib/api-utils";

export async function getUserPermissions(userId: number, role: Role): Promise<Set<Permission>> {
  if (role === "SUPER_ADMIN" || role === "EMPLOYEE") {
    return resolvePermissions(role, []);
  }

  const rows = await prisma.userPermission.findMany({ where: { userId } });
  return resolvePermissions(role, rows);
}

export async function getCurrentAccess(): Promise<{
  user: SessionUser;
  perms: Set<Permission>;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeCode: true,
      isActive: true,
    },
  });

  if (!dbUser || !dbUser.isActive) return null;

  const role = dbUser.role as Role;
  const perms = await getUserPermissions(dbUser.id, role);

  const user: SessionUser = {
    id: dbUser.id,
    role,
    employeeCode: dbUser.employeeCode,
    name: dbUser.name,
    email: dbUser.email,
  };

  return { user, perms };
}
