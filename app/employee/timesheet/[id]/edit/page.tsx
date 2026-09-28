import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
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
  // Drafts, and rejected entries so they can be corrected and resubmitted.
  if (ts.status !== "DRAFT" && ts.status !== "REJECTED") redirect("/employee/timesheet");

  const rejected = ts.status === "REJECTED";

  return (
    <>
      <Topbar
        title="Edit Timesheet"
        subtitle={rejected ? "Fix and resubmit your rejected entry" : "Update your draft entry"}
      />
      <div className="p-6">
        <PageHeader title={rejected ? "Fix Rejected Entry" : "Edit Draft"} />
        {rejected && (
          <div className="mb-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Rejected by your manager</p>
              <p className="mt-0.5">{ts.rejectionNote || "No reason was given."}</p>
              <p className="mt-1 text-xs text-red-700/80">Make your changes, then use Submit to send it for approval again.</p>
            </div>
          </div>
        )}
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
