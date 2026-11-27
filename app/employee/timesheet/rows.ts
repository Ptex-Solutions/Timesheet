// Server-side helpers shared by the pages that render <TimesheetTable>
// (All My Timesheets and the employee dashboard). Kept out of the
// "use client" table module so server components can call them.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DatedHours } from "@/lib/entry-date";
import type { TimesheetRow } from "./timesheet-table";

export const timesheetRowInclude = { client: true, activity: true, task: true } as const;

type RowWithRefs = Prisma.TimesheetGetPayload<{ include: typeof timesheetRowInclude }>;

// Plain, serialisable rows for the client table (no Decimal / Date objects).
export function toTimesheetRow(r: RowWithRefs): TimesheetRow {
  return {
    id: r.id,
    date: r.date.toISOString(),
    weekNo: r.weekNo,
    weekLabel: r.weekLabel,
    clientId: r.clientId,
    clientCode: r.client.code,
    activityId: r.activityId,
    activityCode: r.activity.activityId,
    taskId: r.taskId,
    taskCode: r.task.taskId,
    taskName: r.task.taskName,
    description: r.description,
    hours: Number(r.hours),
    type: r.type,
    status: r.status,
    rejectionNote: r.rejectionNote,
  };
}

// The user's latest logged date and its total hours, so the table's default
// date for a new row is right even when the rows it shows don't include it
// (e.g. the dashboard only shows this week).
export async function latestEntryHint(userId: number): Promise<DatedHours[]> {
  const last = await prisma.timesheet.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!last) return [];
  const sum = await prisma.timesheet.aggregate({
    where: { userId, date: last.date },
    _sum: { hours: true },
  });
  return [{ date: last.date.toISOString().slice(0, 10), hours: Number(sum._sum.hours ?? 0) }];
}

// ---------- All My Timesheets: view / filter / sort / page (URL params) ----------

export const TIMESHEET_VIEWS = ["today", "week", "month", "all"] as const;
export type TimesheetView = (typeof TIMESHEET_VIEWS)[number];
export const SORT_KEYS = ["date", "client", "activity", "task", "hours", "status"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const PAGE_SIZE = 25;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Inclusive YYYY-MM-DD range for a view; week = the app's Sat–Fri week.
export function viewRange(view: TimesheetView, today: string): { from: string; to: string } | null {
  if (view === "today") return { from: today, to: today };
  if (view === "week") {
    const back = (new Date(`${today}T00:00:00Z`).getUTCDay() + 1) % 7; // days since Saturday
    const from = addDays(today, -back);
    return { from, to: addDays(from, 6) };
  }
  if (view === "month") {
    const from = `${today.slice(0, 7)}-01`;
    const next = new Date(`${from}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
  }
  return null;
}

const ORDER: Record<SortKey, (dir: Prisma.SortOrder) => Prisma.TimesheetOrderByWithRelationInput> = {
  date: (dir) => ({ date: dir }),
  client: (dir) => ({ client: { code: dir } }),
  activity: (dir) => ({ activity: { activityId: dir } }),
  task: (dir) => ({ task: { taskId: dir } }),
  hours: (dir) => ({ hours: dir }),
  status: (dir) => ({ status: dir }),
};

export type TimesheetListParams = {
  view?: string;
  status?: string;
  client?: string;
  q?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

// One page of the user's entries plus the totals for the whole filtered set.
export async function listMyTimesheets(userId: number, sp: TimesheetListParams, today: string) {
  const view = (TIMESHEET_VIEWS as readonly string[]).includes(sp.view ?? "") ? (sp.view as TimesheetView) : "month";
  const sort = (SORT_KEYS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as SortKey) : "date";
  const dir: Prisma.SortOrder = sp.dir === "asc" ? "asc" : "desc";
  const status = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].includes(sp.status ?? "")
    ? (sp.status as Prisma.TimesheetWhereInput["status"])
    : undefined;
  const clientId = Number(sp.client) > 0 ? Number(sp.client) : undefined;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const range = viewRange(view, today);

  const where: Prisma.TimesheetWhereInput = {
    userId,
    ...(range ? { date: { gte: new Date(range.from), lte: new Date(range.to) } } : {}),
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { description: { contains: q } },
            { task: { taskId: { contains: q } } },
            { task: { taskName: { contains: q } } },
            { activity: { activityId: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, sum, clients] = await Promise.all([
    prisma.timesheet.count({ where }),
    prisma.timesheet.aggregate({ where, _sum: { hours: true } }),
    // Client filter options: only clients this user has logged time for.
    prisma.master.findMany({
      where: { timesheets: { some: { userId } } },
      select: { id: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const rows = await prisma.timesheet.findMany({
    where,
    include: timesheetRowInclude,
    orderBy: [ORDER[sort](dir), { date: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return {
    rows: rows.map(toTimesheetRow),
    total,
    totalHours: Number(sum._sum.hours ?? 0),
    page,
    pages,
    view,
    range,
    clients,
  };
}
