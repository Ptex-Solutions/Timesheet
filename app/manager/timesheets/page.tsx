import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { Download, Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/utils";
import { TimesheetsFilter } from "./filter";

type Search = {
  status?: string;
  clientId?: string;
  userId?: string;
  from?: string;
  to?: string;
};

export default async function ManagerTimesheetsPage({ searchParams }: { searchParams: Search }) {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("timesheets.view")) redirect("/manager/dashboard");

  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.clientId) where.clientId = parseInt(searchParams.clientId, 10);
  if (searchParams.userId) where.userId = parseInt(searchParams.userId, 10);
  if (searchParams.from || searchParams.to) {
    where.date = {};
    if (searchParams.from) where.date.gte = new Date(searchParams.from);
    if (searchParams.to) where.date.lte = new Date(searchParams.to);
  }

  const [rows, clients, users] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      include: { user: true, client: true, project: true, task: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.client.findMany({ orderBy: { clientCode: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalHours = rows.reduce((s, r) => s + Number(r.hours), 0);

  return (
    <>
      <Topbar title="All Timesheets" subtitle="Organisation-wide submissions" />
      <div className="p-6">
        <PageHeader
          title="All Timesheets"
          description={`${rows.length} entries · ${totalHours.toFixed(2)} hours`}
          actions={
            access.perms.has("mis.edit") ? (
              <Button variant="outline" asChild>
                <Link href="/manager/mis/generate"><Download className="h-4 w-4" /> Export to MIS</Link>
              </Button>
            ) : undefined
          }
        />

        <TimesheetsFilter clients={clients} users={users} initial={searchParams} />

        <Card className="mt-4">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
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
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">No entries match these filters.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{formatDate(r.date)}</td>
                  <td>
                    <p className="font-medium">{r.user.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{r.user.employeeCode}</p>
                  </td>
                  <td><span className="font-mono text-xs">{r.client.clientCode}</span></td>
                  <td className="font-mono text-xs">{r.project.activityId}</td>
                  <td>
                    <p className="font-mono text-xs">{r.task.taskId}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[180px]">{r.task.taskName}</p>
                  </td>
                  <td className="max-w-xs truncate">{r.description}</td>
                  <td className="text-right font-semibold tabular-nums">{Number(r.hours).toFixed(2)}</td>
                  <td className="text-xs">{r.type}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/manager/timesheets/${r.id}`}>Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
