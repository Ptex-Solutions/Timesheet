import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit, requirePermission, type SessionUser } from "@/lib/api-utils";
import { getUserPermissions } from "@/lib/authz";
import {
  ALL_PERMISSIONS,
  canEditAccess,
  diffOverrides,
  isPermission,
  resolvePermissions,
  type Permission,
  type PermissionOverride,
  type Role,
} from "@/lib/permissions";

const bodySchema = z.object({ permissions: z.array(z.string()) });

type Ctx = { params: { userId: string } };

type Target = { id: number; role: Role; current: Set<Permission> };

// Shared authz for PUT/DELETE: access.edit, target exists + active, and the
// actor may edit this target's access.
async function authorize(
  ctx: Ctx
): Promise<{ user: SessionUser; perms: Set<Permission>; target: Target } | NextResponse> {
  const access = await requirePermission("access.edit");
  if (access instanceof NextResponse) return access;

  const id = Number(ctx.params.userId);
  if (!Number.isFinite(id) || !Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });
  if (!target || !target.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = target.role as Role;
  if (role === "SUPER_ADMIN" || role === "EMPLOYEE") {
    return NextResponse.json(
      { error: `Permissions for role ${role} cannot be customised` },
      { status: 400 }
    );
  }
  if (!canEditAccess(access.user.role, access.perms, role)) {
    return NextResponse.json({ error: "You cannot change this user's access" }, { status: 403 });
  }

  const current = await getUserPermissions(id, role);
  return { ...access, target: { id, role, current } };
}

// Every permission the target would newly receive must be held by the actor.
function escalations(actorPerms: Set<Permission>, current: Set<Permission>, next: Set<Permission>) {
  return ALL_PERMISSIONS.filter((p) => next.has(p) && !current.has(p) && !actorPerms.has(p));
}

function changes(before: Set<Permission>, after: Set<Permission>) {
  return {
    granted: ALL_PERMISSIONS.filter((p) => after.has(p) && !before.has(p)),
    revoked: ALL_PERMISSIONS.filter((p) => before.has(p) && !after.has(p)),
  };
}

function escalationError(details: Permission[]) {
  return NextResponse.json(
    { error: "You cannot grant permissions you do not have", details },
    { status: 403 }
  );
}

async function replaceOverrides(userId: number, overrides: PermissionOverride[]) {
  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId } }),
    prisma.userPermission.createMany({ data: overrides.map((o) => ({ userId, ...o })) }),
  ]);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const a = await authorize(ctx);
  if (a instanceof NextResponse) return a;
  const { user, perms, target } = a;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const invalid = parsed.data.permissions.filter((p) => !isPermission(p));
  if (invalid.length) {
    return NextResponse.json({ error: "Unknown permissions", details: invalid }, { status: 400 });
  }
  const desired = parsed.data.permissions as Permission[];

  const overrides = diffOverrides(target.role, desired);
  const next = resolvePermissions(target.role, overrides);

  const blocked = escalations(perms, target.current, next);
  if (blocked.length) return escalationError(blocked);

  await replaceOverrides(target.id, overrides);
  await audit({
    userId: user.id,
    action: "permissions.update",
    entity: "User",
    entityId: target.id,
    meta: changes(target.current, next),
  });

  return NextResponse.json({ data: { effective: Array.from(next), overrides } });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const a = await authorize(ctx);
  if (a instanceof NextResponse) return a;
  const { user, perms, target } = a;

  const next = resolvePermissions(target.role, []);
  // Resetting can re-grant role defaults that were revoked; apply the same
  // no-escalation rule as PUT.
  const blocked = escalations(perms, target.current, next);
  if (blocked.length) return escalationError(blocked);

  await prisma.userPermission.deleteMany({ where: { userId: target.id } });
  await audit({
    userId: user.id,
    action: "permissions.reset",
    entity: "User",
    entityId: target.id,
    meta: changes(target.current, next),
  });

  return NextResponse.json({ data: { effective: Array.from(next), overrides: [] } });
}
