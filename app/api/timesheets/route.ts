import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, readJsonBody } from "@/lib/api-utils";
import { getCurrentAccess } from "@/lib/authz";
import { timesheetCreateSchema } from "@/lib/validations";
import { resolveTimesheetRefs } from "@/lib/timesheet-refs";
import { checkDayCap } from "@/lib/day-cap";
import { FUTURE_ERROR, WEEKEND_ERROR, isFuture, isWeekend } from "@/lib/entry-date";
import { dayCount, isoYearWeek, weekLabelForDate, weekdayKey } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const access = await getCurrentAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user, perms } = access;

  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("from");
  const dateTo = sp.get("to");
  const status = sp.get("status");
  const clientId = sp.get("clientId");
  const userIdParam = sp.get("userId");

  const where: any = {};

  // Without timesheets.view, callers are ALWAYS scoped to their own data
  if (!perms.has("timesheets.view")) {
    where.userId = user.id;
  } else {
    if (userIdParam) where.userId = parseInt(userIdParam, 10);
    // Drafts are the employee's unsubmitted work: staff only ever see their
    // own, never anyone else's.
    where.AND = [{ OR: [{ status: { not: "DRAFT" } }, { userId: user.id }] }];
  }

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }
  if (status) where.status = status;
  if (clientId) where.clientId = parseInt(clientId, 10);

  const data = await prisma.timesheet.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: {
      user: { select: { id: true, name: true, employeeCode: true } },
      client: { select: { id: true, code: true, description: true } },
      activity: {
        select: { id: true, activityId: true, name: true, type: { select: { id: true, code: true } } },
      },
      task: { select: { id: true, taskId: true, taskName: true, poRef: true } },
    },
    take: 500,
  });

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await getCurrentAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = access;

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = timesheetCreateSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const v = parsed.data;

  // Task must belong to the Activity (and to its contract), the author must
  // be a member; clientId, type and the billing role are derived server-side.
  const resolved = await resolveTimesheetRefs(v.activityId, v.taskId, {}, { memberUserId: user.id });
  if (!resolved.ok) return badRequest(resolved.error);
  const refs = resolved.refs;

  const date = new Date(v.date);
  if (isWeekend(date)) return badRequest(WEEKEND_ERROR);
  if (isFuture(date)) return badRequest(FUTURE_ERROR);
  const minutes = Math.round(v.hours * 60);
  const wk = isoYearWeek(date);
  const wkLabel = weekLabelForDate(date);
  const dayKey = weekdayKey(date);

  const dayHours: Record<string, number> = {
    sat: 0, sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0,
  };
  dayHours[dayKey] = v.hours;

  // Per-day cap (MAX_DAY_HOURS), checked and written atomically.
  const result = await prisma.$transaction(async (tx) => {
    const capError = await checkDayCap(tx, user.id, date, v.hours);
    if (capError) return { capError };
    const created = await tx.timesheet.create({
    data: {
      userId: user.id,
      clientId: refs.clientId,
      activityId: refs.activityId,
      taskId: refs.taskId,
      date,
      weekNo: wk.week,
      weekLabel: wkLabel,
      description: v.description,
      hours: v.hours,
      minutes,
      type: refs.type,
      resourceTypeId: refs.resourceTypeId,
      sat: dayHours.sat,
      sun: dayHours.sun,
      mon: dayHours.mon,
      tue: dayHours.tue,
      wed: dayHours.wed,
      thu: dayHours.thu,
      fri: dayHours.fri,
      status: v.status,
      submittedAt: v.status === "SUBMITTED" ? new Date() : null,
    },
    });
    return { created };
  });
  if ("capError" in result) return badRequest(result.capError!);
  const { created } = result;

  await audit({
    userId: user.id,
    action: "create",
    entity: "Timesheet",
    entityId: created.id,
    meta: { status: v.status },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
