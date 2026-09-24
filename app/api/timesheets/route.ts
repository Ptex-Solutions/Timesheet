import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/api-utils";
import { getCurrentAccess } from "@/lib/authz";
import { timesheetCreateSchema } from "@/lib/validations";
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
  } else if (userIdParam) {
    where.userId = parseInt(userIdParam, 10);
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
      client: { select: { id: true, clientCode: true, clientName: true } },
      project: { select: { id: true, activityId: true, description: true } },
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

  const body = await req.json();
  const parsed = timesheetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const v = parsed.data;
  const date = new Date(v.date);
  const minutes = Math.round(v.hours * 60);
  const wk = isoYearWeek(date);
  const wkLabel = weekLabelForDate(date);
  const dayKey = weekdayKey(date);

  // Sanity: hours per day per user shouldn't exceed 24
  const sameDay = await prisma.timesheet.aggregate({
    where: { userId: user.id, date },
    _sum: { hours: true },
  });
  const newTotal = Number(sameDay._sum.hours ?? 0) + v.hours;
  if (newTotal > 24) {
    return NextResponse.json({ error: "Total hours for the day cannot exceed 24" }, { status: 400 });
  }

  const dayHours: Record<string, number> = {
    sat: 0, sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0,
  };
  dayHours[dayKey] = v.hours;

  const created = await prisma.timesheet.create({
    data: {
      userId: user.id,
      clientId: v.clientId,
      projectId: v.projectId,
      taskId: v.taskId,
      date,
      weekNo: wk.week,
      weekLabel: wkLabel,
      description: v.description,
      hours: v.hours,
      minutes,
      type: v.type,
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

  await audit({
    userId: user.id,
    action: "create",
    entity: "Timesheet",
    entityId: created.id,
    meta: { status: v.status },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
