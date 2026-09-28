import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission, requireUser } from "@/lib/api-utils";
import { taskSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const activityIdParam = req.nextUrl.searchParams.get("activityId");
  let activityId: number | null = null;
  if (activityIdParam) {
    activityId = parseId(activityIdParam);
    if (!activityId) return badRequest("Invalid activityId");
  }
  const data = await prisma.task.findMany({
    where: { isActive: true, ...(activityId ? { activityId } : {}) },
    orderBy: { taskId: "asc" },
    include: { activity: { include: { client: { select: { id: true, code: true, description: true } } } } },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("activities.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = taskSchema.safeParse(json.body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const activity = await prisma.activity.findUnique({ where: { id: parsed.data.activityId } });
  if (!activity) return badRequest("Activity not found");
  const created = await prisma.task.create({ data: { ...parsed.data, poRef: parsed.data.poRef ?? null } });
  await audit({ userId: user.id, action: "create", entity: "Task", entityId: created.id });
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
  const parsed = taskSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.activityId !== undefined && parsed.data.activityId !== existing.activityId) {
    // A task with logged time must stay under its activity: moving it would
    // leave those rows pointing at a task of a different activity, and a later
    // hard delete of the new activity would violate the Timesheet.taskId FK.
    const [timesheetCount, sandboxCount] = await Promise.all([
      prisma.timesheet.count({ where: { taskId: id } }),
      prisma.sandboxEntry.count({ where: { taskId: id } }),
    ]);
    if (timesheetCount > 0 || sandboxCount > 0) {
      return badRequest("Cannot move a task that already has timesheet entries");
    }
    const activity = await prisma.activity.findUnique({ where: { id: parsed.data.activityId } });
    if (!activity) return badRequest("Activity not found");
  }
  const updated = await prisma.task.update({ where: { id }, data: parsed.data });
  await audit({ userId: user.id, action: "update", entity: "Task", entityId: id });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("activities.delete");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (!id) return badRequest("Missing or invalid id");
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.task.update({ where: { id }, data: { isActive: false } });
  await audit({ userId: user.id, action: "deactivate", entity: "Task", entityId: id });
  return NextResponse.json({ ok: true });
}
