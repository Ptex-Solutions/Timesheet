import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { TimesheetForm } from "@/components/employee/timesheet-form";

export default async function EditTimesheetPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const id = parseInt(params.id, 10);
  const ts = await prisma.timesheet.findUnique({ where: { id } });
  if (!ts) notFound();
  if (ts.userId !== session!.user.id) redirect("/employee/timesheet");
  if (ts.status !== "DRAFT") redirect("/employee/timesheet");

  return (
    <>
      <Topbar title="Edit Timesheet" subtitle="Update your draft entry" />
      <div className="p-6">
        <PageHeader title="Edit Draft" />
        <TimesheetForm
          mode="edit"
          timesheetId={id}
          initial={{
            date: ts.date.toISOString(),
            clientId: ts.clientId,
            activityId: ts.activityId,
            taskId: ts.taskId,
            hours: Number(ts.hours),
            description: ts.description,
          }}
        />
      </div>
    </>
  );
}
