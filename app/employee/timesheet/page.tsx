import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { TimesheetTable } from "./timesheet-table";
import { timesheetRowInclude, toTimesheetRow } from "./rows";

export default async function MyTimesheetsPage({
  searchParams,
}: {
  searchParams: { add?: string };
}) {
  const session = await auth();
  const userId = session!.user.id;

  const rows = await prisma.timesheet.findMany({
    where: { userId },
    include: timesheetRowInclude,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 200,
  });

  const data = rows.map(toTimesheetRow);

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
