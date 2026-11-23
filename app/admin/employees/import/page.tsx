import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { Topbar } from "@/components/shared/topbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getZohoConfig } from "./actions";
import { ZohoSyncClient } from "./zoho-sync-client";

export default async function ZohoImportPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("employees.view")) {
    redirect("/admin/dashboard");
  }

  const initialConfig = await getZohoConfig();
  const canEdit = access.perms.has("employees.edit");

  return (
    <>
      <Topbar title="Zoho Employee Import" subtitle="Sync team members from Zoho People" />
      <div className="p-6 space-y-6">
        {/* Header with integrated Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              asChild
              className="h-10 w-10 shrink-0 rounded-lg border-slate-200 bg-white shadow-soft hover:bg-slate-50 text-slate-700 hover:text-navy transition-all"
              title="Back to Employees"
            >
              <Link href="/admin/employees">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h2 className="font-display text-2xl font-bold text-navy tracking-tight">
                Sync Employees from Zoho People
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Enter your Zoho Client ID & Secret, generate tokens, and synchronize employee records into your database.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden sm:inline-flex gap-1.5 border-slate-200 bg-white text-slate-700 shadow-soft hover:bg-slate-50 font-medium text-xs"
          >
          </Button>
        </div>

        <ZohoSyncClient initialConfig={initialConfig} canEdit={canEdit} />
      </div>
    </>
  );
}
