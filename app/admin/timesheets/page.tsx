import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TimesheetsFilter } from "./filter";
import { ManagerTimesheetsTable, type ManagerTimesheetRow } from "./timesheets-table";

type Search = {
  status?: string;
  clientId?: string;
  userId?: string;
  from?: string;
  to?: string;
  query?: string;
};

export default async function ManagerTimesheetsPage({ searchParams }: { searchParams: Search }) {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("timesheets.view")) redirect("/admin/dashboard");

  // Drafts are the employee's unsubmitted work — never shown to staff.
  const where: any = { status: { not: "DRAFT" } };
  if (searchParams.status && searchParams.status !== "DRAFT") where.status = searchParams.status;
  if (searchParams.clientId) where.clientId = parseInt(searchParams.clientId, 10);
  if (searchParams.userId) where.userId = parseInt(searchParams.userId, 10);
  if (searchParams.query === "open") where.query = { status: "OPEN" };
  if (searchParams.query === "resolved") where.query = { status: "RESOLVED" };
  if (searchParams.query === "mine") {
    where.query = { status: "OPEN" };
    where.comments = { some: { mentions: { some: { userId: access.user.id } } } };
  }
  if (searchParams.from || searchParams.to) {
    where.date = {};
    if (searchParams.from) where.date.gte = new Date(searchParams.from);
    if (searchParams.to) where.date.lte = new Date(searchParams.to);
  }

  const [rows, clients, users] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      include: {
        user: true,
        client: true,
        activity: true,
        task: true,
        query: { select: { status: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.master.findMany({ where: { type: "CLIENT" }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalHours = rows.reduce((s, r) => s + Number(r.hours), 0);

  const data: ManagerTimesheetRow[] = rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    userName: r.user.name,
    employeeCode: r.user.employeeCode,
    clientCode: r.client.code,
    activityCode: r.activity.activityId,
    taskCode: r.task.taskId,
    taskName: r.task.taskName,
    description: r.description,
    hours: Number(r.hours),
    type: r.type,
    status: r.status,
    queryStatus: r.query?.status ?? null,
    commentCount: r._count.comments,
  }));

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
                <Link href="/admin/mis/generate"><Download className="h-4 w-4" /> Export to MIS</Link>
              </Button>
            ) : undefined
          }
        />

        <TimesheetsFilter
          clients={clients.map((c) => ({ id: c.id, clientCode: c.code, clientName: c.description ?? c.code }))}
          users={users} initial={searchParams} />

        <ManagerTimesheetsTable rows={data} canApprove={access.perms.has("timesheets.approve")} />
      </div>
    </>
  );
}
