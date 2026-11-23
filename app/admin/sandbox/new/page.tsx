import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/app-topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NewSandboxForm } from "./form";

export default async function NewSandboxPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("sandbox.edit")) redirect("/admin/dashboard");

  // Options for the cascading filters (inactive rows included: a sandbox may
  // look back at work logged before something was closed or deactivated).
  const [clients, contracts, activities] = await Promise.all([
    prisma.master.findMany({
      where: { type: "CLIENT" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, description: true },
    }),
    prisma.contract.findMany({
      where: { status: { in: ["ACTIVE", "CLOSED"] } },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        description: true,
        clientId: true,
        status: true,
        tasks: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { taskMaster: { select: { id: true, code: true, description: true } } },
        },
      },
    }),
    prisma.activity.findMany({
      orderBy: { activityId: "asc" },
      select: { id: true, activityId: true, name: true, clientId: true, contractId: true, isActive: true },
    }),
  ]);
  return (
    <>
      <Topbar title="New Sandbox" subtitle="Clone timesheets into a sandbox" />
      <div className="p-6">
        <PageHeader
          title="Create Sandbox Session"
          description="Clones submitted and approved timesheets for a client and date range, optionally narrowed to a contract, activity or task, into a named sandbox you can freely edit."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Setup</CardTitle>
              <CardDescription>Client and dates are required; Contract, Activity and Task narrow the selection.</CardDescription>
            </CardHeader>
            <CardContent>
              <NewSandboxForm
                clients={clients}
                contracts={contracts.map((c) => ({ ...c, tasks: c.tasks.map((t) => t.taskMaster) }))}
                activities={activities}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p><strong>1. Clone</strong> — submitted/approved timesheets in your range are copied into the sandbox.</p>
              <p><strong>2. Edit</strong> — adjust hours, reassign rows, add or soft-delete rows. Originals stay intact.</p>
              <p><strong>3. Finalize</strong> — generate a final MIS report from the sandbox snapshot.</p>
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Sandbox edits are <strong>never visible to employees</strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
