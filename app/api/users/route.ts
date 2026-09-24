import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, requirePermission } from "@/lib/api-utils";
import { canManageRole, type Role } from "@/lib/permissions";
import { userSchema } from "@/lib/validations";

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);

async function isLastActiveSuperAdmin() {
  const count = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
  return count <= 1;
}

const LAST_SUPER_ADMIN = "Cannot remove the last active Super Admin";

class LastSuperAdminError extends Error {
  constructor() {
    super(LAST_SUPER_ADMIN);
  }
}

// Runs a user update atomically with the last-active-Super-Admin invariant.
// The FOR UPDATE locking read serialises concurrent demote/deactivate
// requests (MySQL REPEATABLE READ would otherwise let two transactions each
// see the other's Super Admin still active); the post-update recount then
// rolls back if no active Super Admin would remain.
// `atomic` runs unguarded updates in a transaction too (multi-statement writes).
async function updateUserGuarded<T>(
  guard: boolean,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
  atomic = false
): Promise<T | NextResponse> {
  if (!guard) return atomic ? prisma.$transaction((tx) => run(tx)) : run(prisma);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM User WHERE role = 'SUPER_ADMIN' AND isActive = true FOR UPDATE`;
      const result = await run(tx);
      const remaining = await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
      if (remaining === 0) throw new LastSuperAdminError();
      return result;
    });
  } catch (e) {
    if (e instanceof LastSuperAdminError) {
      return NextResponse.json({ error: LAST_SUPER_ADMIN }, { status: 400 });
    }
    throw e;
  }
}

export async function GET(_req: NextRequest) {
  const access = await requirePermission("employees.view");
  if (access instanceof NextResponse) return access;
  const data = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeCode: true,
      isActive: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("employees.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const body = await req.json();
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  if (!canManageRole(user.role, parsed.data.role)) {
    return NextResponse.json({ error: `You cannot create a user with role ${parsed.data.role}` }, { status: 403 });
  }
  const { password, ...rest } = parsed.data;
  if (!password) return NextResponse.json({ error: "Password required" }, { status: 400 });
  const created = await prisma.user.create({
    data: { ...rest, password: await bcrypt.hash(password, ROUNDS) },
    select: { id: true, name: true, email: true, role: true, employeeCode: true, isActive: true },
  });
  await audit({ userId: user.id, action: "create", entity: "User", entityId: created.id });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const access = await requirePermission("employees.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const body = await req.json();
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const parsed = userSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const targetRole = target.role as Role;
  const isSelf = id === user.id;

  // Editing yourself is always allowed (name/email/password); otherwise the
  // actor must outrank the target.
  if (!isSelf && !canManageRole(user.role, targetRole)) {
    return NextResponse.json({ error: "You cannot modify a user with this role" }, { status: 403 });
  }

  const newRole = parsed.data.role;
  const roleChanging = newRole !== undefined && newRole !== targetRole;
  if (roleChanging) {
    if (isSelf) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 403 });
    }
    if (!canManageRole(user.role, newRole)) {
      return NextResponse.json({ error: `You cannot assign role ${newRole}` }, { status: 403 });
    }
  }

  const deactivating = parsed.data.isActive === false;
  if (deactivating && isSelf) {
    return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 403 });
  }

  const removesSuperAdmin = targetRole === "SUPER_ADMIN" && target.isActive && (roleChanging || deactivating);
  // Fast path; the transaction in updateUserGuarded is the real guard.
  if (removesSuperAdmin && (await isLastActiveSuperAdmin())) {
    return NextResponse.json({ error: LAST_SUPER_ADMIN }, { status: 400 });
  }

  const data: any = { ...parsed.data };
  if (data.password) data.password = await bcrypt.hash(data.password, ROUNDS);
  else delete data.password;
  // A role change clears per-user overrides: they were chosen relative to the
  // old role's defaults and would otherwise resurface on a later re-promotion.
  const updated = await updateUserGuarded(
    removesSuperAdmin,
    async (tx) => {
      if (roleChanging) await tx.userPermission.deleteMany({ where: { userId: id } });
      return tx.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, employeeCode: true, isActive: true },
      });
    },
    roleChanging
  );
  if (updated instanceof NextResponse) return updated;
  await audit({
    userId: user.id,
    action: "update",
    entity: "User",
    entityId: id,
    meta: roleChanging ? { role: { from: targetRole, to: newRole }, permissionsCleared: true } : undefined,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("employees.delete");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (id === user.id) {
    return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 403 });
  }
  const targetRole = target.role as Role;
  if (!canManageRole(user.role, targetRole)) {
    return NextResponse.json({ error: "You cannot modify a user with this role" }, { status: 403 });
  }
  const removesSuperAdmin = targetRole === "SUPER_ADMIN" && target.isActive;
  if (removesSuperAdmin && (await isLastActiveSuperAdmin())) {
    return NextResponse.json({ error: LAST_SUPER_ADMIN }, { status: 400 });
  }

  const result = await updateUserGuarded(removesSuperAdmin, (tx) =>
    tx.user.update({ where: { id }, data: { isActive: false } })
  );
  if (result instanceof NextResponse) return result;
  await audit({ userId: user.id, action: "deactivate", entity: "User", entityId: id });
  return NextResponse.json({ ok: true });
}
