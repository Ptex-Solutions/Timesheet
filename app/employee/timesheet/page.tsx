import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { TimesheetTable, type TimesheetRow } from "./timesheet-table";

export default async function MyTimesheetsPage({
  searchParams,
}: {
  searchParams: { add?: string };
}) {
  const session = await auth();
  const userId = session!.user.id;

  const rows = await prisma.timesheet.findMany({
    where: { userId },
    include: { client: true, activity: true, task: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 200,
  });

  // Plain, serialisable rows for the client table (no Decimal / Date objects).
  const data: TimesheetRow[] = rows.map((r) => ({
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
  }));

  return (
    <>
      <Topbar title="My Timesheets" subtitle="All entries you've logged" />
      <div className="p-6">
        <PageHeader
          title="All My Timesheets"
          description="Add entries right in the table, clone past ones, edit drafts, or submit pending entries."
        />
        <TimesheetTable rows={data} autoAdd={searchParams.add === "1"} />
      </div>
    </>
  );
}
