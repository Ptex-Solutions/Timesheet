import { NextRequest, NextResponse } from "next/server";
import { MasterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { getCurrentAccess } from "@/lib/authz";
import { activitySchema } from "@/lib/validations";
import { activityAdminInclude, activityListInclude, createActivity } from "@/lib/activity-service";
import { ScopeError, applyActivityScope, type ScopeResult } from "@/lib/activity-scope";

// createActivity throws plain Errors for missing / inactive / wrong-type
// masters and applyActivityScope throws ScopeError; both are client errors.
// Anything else (Prisma errors etc.) is a genuine 500.
function clientError(e: unknown): NextResponse | null {
  if (e instanceof ScopeError || (e instanceof Error && e.constructor === Error)) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  return null;
}

const IMMUTABLE_FIELDS = ["clientId", "typeId", "productId", "versionId", "moduleId"] as const;
const IMMUTABLE_MESSAGE =
  "Client, Type, Product, Version and Module cannot be changed after an Activity is created";

export async function GET(req: NextRequest) {
  // Any signed-in, active user (employees need this for timesheet dropdowns);
  // mutations below stay gated on activities.edit / activities.delete. Callers
  // without activities.view only see active activities and active tasks.
  const access = await getCurrentAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Callers can force active-only rows regardless of their permission level
  // (e.g. an employee timesheet form should never surface inactive activities,
  // even for a staff member with activities.view browsing their own timesheet).
  const forceActive = req.nextUrl.searchParams.get("active") === "1";
  const isAdminView = !forceActive && access.perms.has("activities.view");

  const clientIdParam = req.nextUrl.searchParams.get("clientId");
  let clientId: number | undefined;
  if (clientIdParam) {
    clientId = Number(clientIdParam);
    if (!Number.isInteger(clientId) || clientId <= 0) return badRequest("Invalid clientId");
  }

  const data = await prisma.activity.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      // Timesheet-entry view: only active Activities the caller is a member
      // of (pre-contract Activities without a contract stay open to all).
      ...(isAdminView
        ? {}
        : {
            isActive: true,
            OR: [{ contractId: null }, { members: { some: { userId: access.user.id } } }],
          }),
    },
    orderBy: { activityId: "asc" },
    include: isAdminView
      ? activityAdminInclude
      : { ...activityListInclude, tasks: { ...activityListInclude.tasks, where: { isActive: true } } },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("activities.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = activitySchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { contractId, contractTaskIds, members, ...activityInput } = parsed.data;
  if (!contractId) return badRequest("Select the Contract / SOW this Activity executes");

  let created;
  let scope: ScopeResult;
  try {
    // Activity + its task subset + members commit together or not at all.
    ({ created, scope } = await prisma.$transaction(
      async (tx) => {
        const created = await createActivity(activityInput, tx);
        const scope = await applyActivityScope(tx, created.id, {
          contractId,
          contractTaskIds: contractTaskIds ?? [],
          members: members ?? [],
        });
        return { created, scope };
      },
      { timeout: 20_000 }
    ));
  } catch (e) {
    const res = clientError(e);
    if (res) return res;
    throw e;
  }

  await audit({
    userId: user.id,
    action: "create",
    entity: "Activity",
    entityId: created.id,
    meta: { activityId: created.activityId, contractId, tasks: scope.added, members: scope.members },
  });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const access = await requirePermission("activities.edit");
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

  const { name, cloudOnPremId, isActive, contractId, contractTaskIds, members } = parsed.data;

  if (cloudOnPremId != null && cloudOnPremId !== existing.cloudOnPremId) {
    const m = await prisma.master.findUnique({ where: { id: cloudOnPremId } });
    if (!m || m.type !== MasterType.CLOUD_ON_PREM || !m.isActive) {
      return badRequest("Cloud / On Prem must be an active CLOUD_ON_PREM master");
    }
  }

  let data;
  let scope: ScopeResult | null = null;
  try {
    ({ data, scope } = await prisma.$transaction(
      async (tx) => {
        const data = await tx.activity.update({
          where: { id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(cloudOnPremId !== undefined ? { cloudOnPremId: cloudOnPremId ?? null } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
          },
        });
        // Scope is only touched when the caller sends a contract; omitted
        // task ids / members keep the current ones.
        let scope: ScopeResult | null = null;
        if (contractId !== undefined) {
          const current = await tx.activity.findUniqueOrThrow({
            where: { id },
            include: { tasks: true, members: true },
          });
          scope = await applyActivityScope(tx, id, {
            contractId,
            contractTaskIds:
              contractTaskIds ??
              current.tasks.filter((t) => t.isActive && t.contractTaskId !== null).map((t) => t.contractTaskId!),
            members:
              members ?? current.members.map((m) => ({ userId: m.userId, resourceTypeId: m.resourceTypeId })),
          });
        }
        return { data, scope };
      },
      { timeout: 20_000 }
    ));
  } catch (e) {
    const res = clientError(e);
    if (res) return res;
    throw e;
  }
  await audit({
    userId: user.id,
    action: "update",
    entity: "Activity",
    entityId: id,
    ...(scope ? { meta: { contractId, ...scope } } : {}),
  });
  return NextResponse.json({ data, scope });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("activities.delete");
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
