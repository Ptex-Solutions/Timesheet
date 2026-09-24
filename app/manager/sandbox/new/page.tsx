import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NewSandboxForm } from "./form";

export default async function NewSandboxPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("sandbox.edit")) redirect("/manager/dashboard");
  return (
    <>
      <Topbar title="New Sandbox" subtitle="Clone timesheets into a sandbox" />
      <div className="p-6">
        <PageHeader
          title="Create Sandbox Session"
          description="Clones approved/submitted timesheets in a date range into a named sandbox you can freely edit."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Setup</CardTitle>
              <CardDescription>Pick a label and date range to clone from real timesheets.</CardDescription>
            </CardHeader>
            <CardContent>
              <NewSandboxForm />
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
