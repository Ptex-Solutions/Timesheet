import { NextRequest, NextResponse } from "next/server";
import { Prisma, MasterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, requirePermission, requireUser } from "@/lib/api-utils";
import { masterSchema, MASTER_TYPES } from "@/lib/validations";

function isValidMasterType(v: unknown): v is MasterType {
  return typeof v === "string" && (MASTER_TYPES as readonly string[]).includes(v);
}

function conflictMessage(type: MasterType, code: string) {
  return `A ${type} master with code "${code}" already exists`;
}

export async function GET(req: NextRequest) {
  // Any signed-in user (employees need this for timesheet dropdowns);
  // mutations below stay gated on clients.edit / clients.delete.
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const type = req.nextUrl.searchParams.get("type");
  if (!isValidMasterType(type)) {
    return badRequest("Invalid or missing type", { allowed: MASTER_TYPES });
  }

  const data = await prisma.master.findMany({
    where: { type },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const body = await req.json();
  const parsed = masterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await prisma.master.create({ data: parsed.data });
    await audit({ userId: user.id, action: "create", entity: "Master", entityId: created.id });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: conflictMessage(parsed.data.type, parsed.data.code) },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function PUT(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const body = await req.json();
  const id = Number(body?.id);
  if (!id) return badRequest("Missing id");

  const existing = await prisma.master.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = masterSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  // `type` is immutable — only reject if the caller sends a *different* type.
  if (parsed.data.type !== undefined && parsed.data.type !== existing.type) {
    return badRequest("Master type cannot be changed");
  }

  const { type: _ignoredType, ...editable } = parsed.data;
  void _ignoredType;

  try {
    const updated = await prisma.master.update({ where: { id }, data: editable });
    await audit({ userId: user.id, action: "update", entity: "Master", entityId: id });
    return NextResponse.json({ data: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: conflictMessage(existing.type, editable.code ?? existing.code) },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("clients.delete");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return badRequest("Missing id");

  const existing = await prisma.master.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [activityRefCount, timesheetCount, sandboxCount] = await Promise.all([
    prisma.activity.count({
      where: {
        OR: [
          { clientId: id },
          { typeId: id },
          { productId: id },
          { versionId: id },
          { moduleId: id },
          { cloudOnPremId: id },
        ],
      },
    }),
    prisma.timesheet.count({ where: { clientId: id } }),
    prisma.sandboxEntry.count({ where: { clientId: id } }),
  ]);

  const inUse = activityRefCount > 0 || timesheetCount > 0 || sandboxCount > 0;

  if (inUse) {
    const data = await prisma.master.update({ where: { id }, data: { isActive: false } });
    await audit({ userId: user.id, action: "deactivate", entity: "Master", entityId: id });
    return NextResponse.json({ data, softDeleted: true });
  }

  await prisma.master.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", entity: "Master", entityId: id });
  return NextResponse.json({ ok: true });
}
