import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { sandboxCreateSchema, sandboxEntrySchema } from "@/lib/validations";
import { resolveTimesheetRefs } from "@/lib/timesheet-refs";
import { dayCount, isoYearWeek, weekLabelForDate, weekdayKey } from "@/lib/utils";

// GET: list distinct sandbox labels with counts
export async function GET(_req: NextRequest) {
  const access = await requirePermission("sandbox.view");
  if (access instanceof NextResponse) return access;

  const grouped = await prisma.sandboxEntry.groupBy({
    by: ["sandboxLabel"],
    _count: { id: true },
    _min: { date: true, createdAt: true },
    _max: { date: true, updatedAt: true },
  });

  const data = grouped.map((g) => ({
    label: g.sandboxLabel,
    count: g._count.id,
    dateFrom: g._min.date,
    dateTo: g._max.date,
    createdAt: g._min.createdAt,
    updatedAt: g._max.updatedAt,
  }));

  return NextResponse.json({ data });
}

// POST: clone real timesheets in date range into a new sandbox label
export async function POST(req: NextRequest) {
  const access = await requirePermission("sandbox.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const body = await req.json();
  const parsed = sandboxCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { sandboxLabel, dateFrom, dateTo } = parsed.data;

  const existing = await prisma.sandboxEntry.findFirst({ where: { sandboxLabel } });
  if (existing) return NextResponse.json({ error: "Sandbox label already exists" }, { status: 409 });

  const source = await prisma.timesheet.findMany({
    where: {
      date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      // Never clone drafts: they are the employee's unsubmitted work.
      status: { in: ["SUBMITTED", "APPROVED"] },
    },
  });

  if (!source.length) return NextResponse.json({ error: "No timesheets in range" }, { status: 400 });

  const created = await prisma.sandboxEntry.createMany({
    data: source.map((t) => ({
      originalId: t.id,
      userId: t.userId,
      clientId: t.clientId,
      activityId: t.activityId,
      taskId: t.taskId,
      date: t.date,
      weekNo: t.weekNo,
      weekLabel: t.weekLabel,
      description: t.description,
      hours: t.hours,
      minutes: t.minutes,
      type: t.type,
      sat: t.sat, sun: t.sun, mon: t.mon, tue: t.tue, wed: t.wed, thu: t.thu, fri: t.fri,
      sandboxLabel,
    })),
  });

  await audit({
    userId: user.id,
    action: "create",
    entity: "Sandbox",
    entityId: sandboxLabel,
    meta: { rowsCloned: created.count, dateFrom, dateTo },
  });

  return NextResponse.json({ data: { sandboxLabel, rows: created.count } }, { status: 201 });
}

// PUT: add or update a single sandbox entry (in-sandbox edit)
export async function PUT(req: NextRequest) {
  const access = await requirePermission("sandbox.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const body = json.body;
  const hasId = body?.id !== undefined && body?.id !== null && body?.id !== "";
  const id = hasId ? parseId(body.id) : null;
  if (hasId && !id) return badRequest("Invalid id");

  if (id) {
    // update existing
    const existing = await prisma.sandboxEntry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const v = body;
    const data: any = {
      description: v.description ?? existing.description,
      hours: v.hours ?? Number(existing.hours),
      minutes: Math.round((v.hours ?? Number(existing.hours)) * 60),
      type: v.type ?? existing.type,
      managerNote: v.managerNote ?? existing.managerNote,
      isModified: true,
    };
    if (v.userId) data.userId = Number(v.userId);
    if (v.clientId != null || v.activityId != null || v.taskId != null) {
      // Task must belong to the Activity; clientId is derived from it.
      // Unchanged ids may reference since-deactivated rows.
      const activityId = v.activityId != null ? parseId(v.activityId) : existing.activityId;
      const taskId = v.taskId != null ? parseId(v.taskId) : existing.taskId;
      if (!activityId || !taskId) return badRequest("Invalid activityId or taskId");
      const resolved = await resolveTimesheetRefs(activityId, taskId, {
        activityId: existing.activityId,
        taskId: existing.taskId,
      });
      if (!resolved.ok) return badRequest(resolved.error);
      data.clientId = resolved.refs.clientId;
      data.activityId = resolved.refs.activityId;
      data.taskId = resolved.refs.taskId;
      // Follow the new activity's type unless the manager overrode it.
      if (v.type == null && resolved.refs.activityId !== existing.activityId) data.type = resolved.refs.type;
    }
    if (v.date) {
      const d = new Date(v.date);
      data.date = d;
      data.weekNo = isoYearWeek(d).week;
      data.weekLabel = weekLabelForDate(d);
      data.sat = 0; data.sun = 0; data.mon = 0; data.tue = 0; data.wed = 0; data.thu = 0; data.fri = 0;
      (data as any)[weekdayKey(d)] = data.hours;
    }
    const updated = await prisma.sandboxEntry.update({ where: { id }, data });
    await audit({ userId: user.id, action: "update", entity: "SandboxEntry", entityId: id });
    return NextResponse.json({ data: updated });
  }

  // create new
  const parsed = sandboxEntrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data;
  const resolved = await resolveTimesheetRefs(v.activityId, v.taskId);
  if (!resolved.ok) return badRequest(resolved.error);
  const refs = resolved.refs;
  const d = new Date(v.date);
  const dayKey = weekdayKey(d);
  const dayHours: Record<string, number> = { sat:0, sun:0, mon:0, tue:0, wed:0, thu:0, fri:0 };
  dayHours[dayKey] = v.hours;

  const created = await prisma.sandboxEntry.create({
    data: {
      sandboxLabel: v.sandboxLabel,
      userId: v.userId,
      clientId: refs.clientId,
      activityId: refs.activityId,
      taskId: refs.taskId,
      date: d,
      weekNo: isoYearWeek(d).week,
      weekLabel: weekLabelForDate(d),
      description: v.description,
      hours: v.hours,
      minutes: Math.round(v.hours * 60),
      type: v.type ?? refs.type,
      sat: dayHours.sat, sun: dayHours.sun, mon: dayHours.mon,
      tue: dayHours.tue, wed: dayHours.wed, thu: dayHours.thu, fri: dayHours.fri,
      managerNote: v.managerNote ?? null,
      isAdded: true,
    },
  });
  await audit({ userId: user.id, action: "create", entity: "SandboxEntry", entityId: created.id });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("sandbox.delete");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const id = Number(req.nextUrl.searchParams.get("id"));
  const label = req.nextUrl.searchParams.get("label");

  if (id) {
    await prisma.sandboxEntry.update({ where: { id }, data: { isDeleted: true } });
    await audit({ userId: user.id, action: "soft-delete", entity: "SandboxEntry", entityId: id });
    return NextResponse.json({ ok: true });
  }
  if (label) {
    const result = await prisma.sandboxEntry.deleteMany({ where: { sandboxLabel: label } });
    await audit({ userId: user.id, action: "purge", entity: "Sandbox", entityId: label, meta: { rows: result.count } });
    return NextResponse.json({ ok: true, removed: result.count });
  }
  return NextResponse.json({ error: "Missing id or label" }, { status: 400 });
}
