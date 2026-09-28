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
