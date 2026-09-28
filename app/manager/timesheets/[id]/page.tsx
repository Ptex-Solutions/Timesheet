import { notFound, redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/utils";
import { ApprovalPanel } from "./approval-panel";
import { QueryPanel } from "./query-panel";
import { listMentionableStaff, loadQueryThread } from "@/lib/timesheet-query";

export default async function TimesheetDetailPage({ params }: { params: { id: string } }) {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("timesheets.view")) redirect("/manager/dashboard");

  const id = parseInt(params.id, 10);
  const ts = await prisma.timesheet.findUnique({
    where: { id },
    include: { user: true, client: true, activity: true, task: true },
  });
  // Drafts are private to the employee until submitted.
  if (!ts || ts.status === "DRAFT") notFound();

  const [thread, staff] = await Promise.all([loadQueryThread(ts.id), listMentionableStaff()]);

  return (
    <>
      <Topbar title="Timesheet Detail" subtitle={`#${ts.id}`} />
      <div className="p-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/timesheets"><ArrowLeft className="h-4 w-4" /> Back to all</Link>
          </Button>
        </div>
        <PageHeader
          title={`${ts.user.name} · ${formatDate(ts.date)}`}
          description={`${ts.client.code} · ${ts.activity.activityId} · ${ts.task.taskId}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between flex">
              <CardTitle>Entry Details</CardTitle>
              <StatusPill status={ts.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Employee" value={`${ts.user.name} (${ts.user.employeeCode})`} />
              <Field label="Client" value={ts.client.description ? `${ts.client.code} – ${ts.client.description}` : ts.client.code} />
              <Field label="Activity ID" value={ts.activity.activityId} mono />
              <Field label="Activity Description" value={ts.activity.name} />
              <Field label="Task" value={`${ts.task.taskId} – ${ts.task.taskName}`} />
              {ts.task.poRef && <Field label="PO Reference" value={ts.task.poRef} mono />}
              <Field label="Date" value={formatDate(ts.date)} />
              <Field label="Week" value={`Week ${ts.weekNo} · ${ts.weekLabel}`} />
              <Field label="Hours" value={`${Number(ts.hours).toFixed(2)} h (${ts.minutes} mins)`} highlight />
              <Field label="Type" value={ts.type} />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Description</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm">{ts.description}</div>
              </div>
              {ts.rejectionNote && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-500 mb-1">Rejection Note</p>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{ts.rejectionNote}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <ApprovalPanel
              id={ts.id}
              status={ts.status}
              canApprove={access.perms.has("timesheets.approve")}
              canReopen={access.perms.has("timesheets.reopen")}
            />
            <QueryPanel timesheetId={ts.id} initial={thread} staff={staff} currentUserId={access.user.id} />
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 items-baseline border-b border-slate-100 pb-2 last:border-0">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`col-span-2 font-medium text-navy ${mono ? "font-mono text-sm" : ""} ${highlight ? "text-brand text-base" : ""}`}>
        {value}
      </p>
    </div>
  );
}
