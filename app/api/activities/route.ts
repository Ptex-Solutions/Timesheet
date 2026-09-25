import { NextRequest, NextResponse } from "next/server";
import { MasterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { getCurrentAccess } from "@/lib/authz";
import { activitySchema } from "@/lib/validations";
import { activityListInclude, createActivity } from "@/lib/activity-service";

const IMMUTABLE_FIELDS = ["clientId", "typeId", "productId", "versionId", "moduleId"] as const;
const IMMUTABLE_MESSAGE =
  "Client, Type, Product, Version and Module cannot be changed after an Activity is created";

export async function GET(req: NextRequest) {
  // Any signed-in, active user (employees need this for timesheet dropdowns);
  // mutations below stay gated on clients.edit / clients.delete. Callers
  // without clients.view only see active activities and active tasks.
  const access = await getCurrentAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdminView = access.perms.has("clients.view");

  const clientIdParam = req.nextUrl.searchParams.get("clientId");
  let clientId: number | undefined;
  if (clientIdParam) {
    clientId = Number(clientIdParam);
    if (!Number.isInteger(clientId) || clientId <= 0) return badRequest("Invalid clientId");
  }

  const data = await prisma.activity.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(isAdminView ? {} : { isActive: true }),
    },
    orderBy: { activityId: "asc" },
    include: isAdminView
      ? activityListInclude
      : { ...activityListInclude, tasks: { ...activityListInclude.tasks, where: { isActive: true } } },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = activitySchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  let created;
  try {
    created = await createActivity(parsed.data);
  } catch (e) {
    // createActivity throws plain Errors for missing / inactive / wrong-type
    // masters; anything else (Prisma errors etc.) is a genuine 500.
    if (e instanceof Error && e.constructor === Error) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  await audit({
    userId: user.id,
    action: "create",
    entity: "Activity",
    entityId: created.id,
    meta: { activityId: created.activityId },
  });
  return NextResponse.json({ data: created }, { status: 201 });
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

  const parsed = activitySchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ID-forming masters are immutable: reject only a *different* value.
  for (const f of IMMUTABLE_FIELDS) {
    const v = parsed.data[f];
    if (v !== undefined && v !== existing[f]) return badRequest(IMMUTABLE_MESSAGE);
  }

  const { name, cloudOnPremId, isActive } = parsed.data;

  if (cloudOnPremId != null && cloudOnPremId !== existing.cloudOnPremId) {
    const m = await prisma.master.findUnique({ where: { id: cloudOnPremId } });
    if (!m || m.type !== MasterType.CLOUD_ON_PREM || !m.isActive) {
      return badRequest("Cloud / On Prem must be an active CLOUD_ON_PREM master");
    }
  }

  const data = await prisma.activity.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(cloudOnPremId !== undefined ? { cloudOnPremId: cloudOnPremId ?? null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  await audit({ userId: user.id, action: "update", entity: "Activity", entityId: id });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("clients.delete");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (!id) return badRequest("Missing or invalid id");

  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [timesheetCount, sandboxCount] = await Promise.all([
    prisma.timesheet.count({ where: { activityId: id } }),
    prisma.sandboxEntry.count({ where: { activityId: id } }),
  ]);

  if (timesheetCount > 0 || sandboxCount > 0) {
    const data = await prisma.activity.update({ where: { id }, data: { isActive: false } });
    await audit({
      userId: user.id,
      action: "deactivate",
      entity: "Activity",
      entityId: id,
      meta: { activityId: existing.activityId },
    });
    return NextResponse.json({ data, softDeleted: true });
  }

  // Task has no cascade from Activity — remove tasks first, atomically.
  await prisma.$transaction([
    prisma.task.deleteMany({ where: { activityId: id } }),
    prisma.activity.delete({ where: { id } }),
  ]);
  await audit({
    userId: user.id,
    action: "delete",
    entity: "Activity",
    entityId: id,
    meta: { activityId: existing.activityId },
  });
  return NextResponse.json({ ok: true });
}
