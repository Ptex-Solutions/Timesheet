import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/utils";
import { TimesheetActions } from "./actions";

export default async function MyTimesheetsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const rows = await prisma.timesheet.findMany({
    where: { userId },
    include: { client: true, activity: true, task: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 200,
  });

  return (
    <>
      <Topbar title="My Timesheets" subtitle="All entries you've logged" />
      <div className="p-6">
        <PageHeader
          title="All My Timesheets"
          description="View, edit drafts, or submit pending entries."
          actions={
            <Button asChild>
              <Link href="/employee/timesheet/new"><PlusCircle className="h-4 w-4" /> New Entry</Link>
            </Button>
          }
        />

        <Card>
          <table className="table-clean">
            <thead>
              <tr>
                <th>Date</th>
                <th>Week</th>
                <th>Client</th>
                <th>Activity</th>
                <th>Task</th>
                <th>Description</th>
                <th className="text-right">Hours</th>
                <th>Type</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    No timesheets yet. <Link href="/employee/timesheet/new" className="text-brand font-semibold ml-1">Log your first</Link>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{formatDate(r.date)}</td>
                  <td className="text-xs text-slate-500 font-mono whitespace-nowrap">W{r.weekNo} · {r.weekLabel}</td>
                  <td><span className="font-mono text-xs">{r.client.code}</span></td>
                  <td className="font-mono text-xs">{r.activity.activityId}</td>
                  <td>
                    <p className="text-xs font-mono">{r.task.taskId}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[180px]">{r.task.taskName}</p>
                  </td>
                  <td className="max-w-xs truncate">{r.description}</td>
                  <td className="text-right font-semibold tabular-nums">{Number(r.hours).toFixed(2)}</td>
                  <td className="text-xs">{r.type}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td><TimesheetActions id={r.id} status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
