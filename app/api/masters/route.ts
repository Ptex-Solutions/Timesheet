import { NextRequest, NextResponse } from "next/server";
import { Prisma, MasterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { getCurrentAccess } from "@/lib/authz";
import { masterSchema, MASTER_TYPES } from "@/lib/validations";

function isValidMasterType(v: unknown): v is MasterType {
  return typeof v === "string" && (MASTER_TYPES as readonly string[]).includes(v);
}

function conflictMessage(type: MasterType, code: string) {
  return `A ${type} master with code "${code}" already exists`;
}

export async function GET(req: NextRequest) {
  // Any signed-in, active user (employees need this for timesheet dropdowns);
  // mutations below stay gated on clients.edit / clients.delete. Callers
  // without clients.view only see active masters.
  const access = await getCurrentAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Callers can force active-only rows regardless of their permission level
  // (e.g. an employee timesheet form should never surface inactive masters,
  // even for a staff member with clients.view browsing their own timesheet).
  const forceActive = req.nextUrl.searchParams.get("active") === "1";
  const isAdminView = !forceActive && access.perms.has("clients.view");

  const type = req.nextUrl.searchParams.get("type");
  if (!isValidMasterType(type)) {
    return badRequest("Invalid or missing type", { allowed: MASTER_TYPES });
  }

  const data = await prisma.master.findMany({
    where: isAdminView ? { type } : { type, isActive: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = masterSchema.safeParse(json.body);
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

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const body = json.body;
  const id = parseId(body?.id);
  if (!id) return badRequest("Missing or invalid id");

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

  // `code` is baked into Activity.activityId (and copied into Timesheet.type
  // strings via the activity relation) once this master is referenced, so it
  // can't change after that — mirror the reference check DELETE already does.
  if (editable.code !== undefined && editable.code !== existing.code) {
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

    if (activityRefCount > 0 || timesheetCount > 0 || sandboxCount > 0) {
      return NextResponse.json(
        { error: "Cannot change the code of a master that is already in use — create a new one instead." },
        { status: 400 }
      );
    }
  }

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

  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (!id) return badRequest("Missing or invalid id");

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
