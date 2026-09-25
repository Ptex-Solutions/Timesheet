import { prisma } from "@/lib/prisma";
import { dayCount, monthName } from "@/lib/utils";

export type MISRow = {
  month: string;
  weekNo: number;
  weekLabel: string;
  date: string;
  resource: string;
  role: string;
  clientCode: string;
  activityId: string;
  description: string;
  hours: number;
  type: string;
  beelineTask: string;
  taskId: string;
  poRef: string | null;
  minutes: number;
  sat: number;
  sun: number;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  dayCount: number;
  // For grouping
  userId: number;
  clientId: number;
};

export type MISData = {
  rows: MISRow[];
  totals: {
    totalHours: number;
    totalMinutes: number;
    totalRows: number;
    employees: number;
    clients: number;
  };
  byEmployee: Array<{
    userId: number;
    employee: string;
    hours: number;
    minutes: number;
    days: number;
  }>;
  byClient: Array<{
    clientId: number;
    clientCode: string;
    clientName: string;
    hours: number;
    minutes: number;
  }>;
  byType: Array<{ type: string; hours: number }>;
  byWeek: Array<{ weekLabel: string; hours: number }>;
  byEmployeePerWeek: Array<{ weekLabel: string; [employee: string]: number | string }>;
};

export async function generateMIS(params: {
  source: "timesheets" | "sandbox";
  sandboxLabel?: string;
  dateFrom: Date;
  dateTo: Date;
  employeeIds?: number[];
  clientIds?: number[];
}): Promise<MISData> {
  const where: any = {
    date: { gte: params.dateFrom, lte: params.dateTo },
  };
  if (params.employeeIds?.length) where.userId = { in: params.employeeIds };
  if (params.clientIds?.length) where.clientId = { in: params.clientIds };

  let raw: any[] = [];

  if (params.source === "timesheets") {
    where.status = { in: ["SUBMITTED", "APPROVED"] };
    raw = await prisma.timesheet.findMany({
      where,
      include: {
        user: true,
        client: true,
        activity: true,
        task: true,
      },
      orderBy: [{ date: "asc" }, { userId: "asc" }],
    });
  } else {
    if (!params.sandboxLabel) throw new Error("sandboxLabel required for sandbox source");
    where.sandboxLabel = params.sandboxLabel;
    where.isDeleted = false;
    const sandboxRows = await prisma.sandboxEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { userId: "asc" }],
    });
    // hydrate via separate queries for relations
    const userIds = [...new Set(sandboxRows.map((r) => r.userId))];
    const clientIds = [...new Set(sandboxRows.map((r) => r.clientId))];
    const activityIds = [...new Set(sandboxRows.map((r) => r.activityId))];
    const taskIds = [...new Set(sandboxRows.map((r) => r.taskId))];
    const [users, clients, activities, tasks] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } } }),
      prisma.master.findMany({ where: { id: { in: clientIds } } }),
      prisma.activity.findMany({ where: { id: { in: activityIds } } }),
      prisma.task.findMany({ where: { id: { in: taskIds } } }),
    ]);
    const uMap = new Map(users.map((u) => [u.id, u]));
    const cMap = new Map(clients.map((c) => [c.id, c]));
    const aMap = new Map(activities.map((a) => [a.id, a]));
    const tMap = new Map(tasks.map((t) => [t.id, t]));
    raw = sandboxRows.map((r) => ({
      ...r,
      user: uMap.get(r.userId)!,
      client: cMap.get(r.clientId)!,
      activity: aMap.get(r.activityId)!,
      task: tMap.get(r.taskId)!,
    }));
  }

  const rows: MISRow[] = raw.map((r) => ({
    month: monthName(new Date(r.date)),
    weekNo: r.weekNo,
    weekLabel: r.weekLabel ?? "",
    date: new Date(r.date).toISOString().slice(0, 10),
    resource: r.user?.employeeCode ?? "",
    role: r.user?.role ?? "EMPLOYEE",
    clientCode: r.client?.code ?? "",
    activityId: r.activity?.activityId ?? "",
    description: r.description,
    hours: Number(r.hours),
    type: r.type,
    beelineTask: r.task?.taskName ?? "",
    taskId: r.task?.taskId ?? "",
    poRef: r.task?.poRef ?? null,
    minutes: r.minutes,
    sat: Number(r.sat),
    sun: Number(r.sun),
    mon: Number(r.mon),
    tue: Number(r.tue),
    wed: Number(r.wed),
    thu: Number(r.thu),
    fri: Number(r.fri),
    dayCount: dayCount(new Date(r.date)),
    userId: r.userId,
    clientId: r.clientId,
  }));

  // Aggregations
  const empMap = new Map<number, { employee: string; hours: number; minutes: number; days: Set<string> }>();
  const cliMap = new Map<number, { clientCode: string; clientName: string; hours: number; minutes: number }>();
  const typeMap = new Map<string, number>();
  const weekMap = new Map<string, number>();
  const empWkMap = new Map<string, Map<string, number>>(); // weekLabel -> emp -> hours
  const empNames = new Set<string>();

  for (const r of rows) {
    const e = empMap.get(r.userId) ?? {
      employee: r.resource,
      hours: 0,
      minutes: 0,
      days: new Set<string>(),
    };
    e.hours += r.hours;
    e.minutes += r.minutes;
    e.days.add(r.date);
    empMap.set(r.userId, e);

    const c = cliMap.get(r.clientId) ?? {
      clientCode: r.clientCode,
      clientName: raw.find((x) => x.clientId === r.clientId)?.client?.description || r.clientCode,
      hours: 0,
      minutes: 0,
    };
    c.hours += r.hours;
    c.minutes += r.minutes;
    cliMap.set(r.clientId, c);

    typeMap.set(r.type, (typeMap.get(r.type) ?? 0) + r.hours);
    weekMap.set(r.weekLabel, (weekMap.get(r.weekLabel) ?? 0) + r.hours);

    const wkBucket = empWkMap.get(r.weekLabel) ?? new Map<string, number>();
    wkBucket.set(r.resource, (wkBucket.get(r.resource) ?? 0) + r.hours);
    empWkMap.set(r.weekLabel, wkBucket);
    empNames.add(r.resource);
  }

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalMinutes = rows.reduce((s, r) => s + r.minutes, 0);

  return {
    rows,
    totals: {
      totalHours: Number(totalHours.toFixed(2)),
      totalMinutes,
      totalRows: rows.length,
      employees: empMap.size,
      clients: cliMap.size,
    },
    byEmployee: Array.from(empMap, ([userId, v]) => ({
      userId,
      employee: v.employee,
      hours: Number(v.hours.toFixed(2)),
      minutes: v.minutes,
      days: v.days.size,
    })).sort((a, b) => b.hours - a.hours),
    byClient: Array.from(cliMap, ([clientId, v]) => ({
      clientId,
      clientCode: v.clientCode,
      clientName: v.clientName,
      hours: Number(v.hours.toFixed(2)),
      minutes: v.minutes,
    })).sort((a, b) => b.hours - a.hours),
    byType: Array.from(typeMap, ([type, hours]) => ({ type, hours: Number(hours.toFixed(2)) })),
    byWeek: Array.from(weekMap, ([weekLabel, hours]) => ({
      weekLabel,
      hours: Number(hours.toFixed(2)),
    })),
    byEmployeePerWeek: Array.from(empWkMap, ([weekLabel, m]) => {
      const out: any = { weekLabel };
      for (const name of empNames) out[name] = Number((m.get(name) ?? 0).toFixed(2));
      return out;
    }),
  };
}

export async function getSandboxDiff(label: string) {
  const entries = await prisma.sandboxEntry.findMany({
    where: { sandboxLabel: label },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const added = entries.filter((e) => e.isAdded && !e.isDeleted);
  const removed = entries.filter((e) => e.isDeleted);
  const modified = entries.filter((e) => e.isModified && !e.isDeleted && !e.isAdded);
  const unchanged = entries.filter((e) => !e.isAdded && !e.isModified && !e.isDeleted);

  return { added, removed, modified, unchanged, total: entries.length };
}
