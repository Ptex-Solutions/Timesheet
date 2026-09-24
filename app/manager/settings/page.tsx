import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/shared/role-badge";
import { ROLES } from "@/lib/permissions";
import { ShieldCheck, Database, Lock, FileSpreadsheet, Beaker } from "lucide-react";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" subtitle="System overview" />
      <div className="p-6">
        <PageHeader
          title="System Settings"
          description="Operational details about your Ptex Dashboard installation."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle><Database className="inline h-4 w-4 mr-1 text-brand" /> Data Sources</CardTitle>
              <CardDescription>How timesheets and master data are organized.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <Row label="Database" value="MySQL via Prisma" />
              <Row label="Master entities" value="Clients · Projects · Tasks · Users" />
              <Row label="Transactional" value="Timesheets, SandboxEntries, MISReports, AuditLogs" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><ShieldCheck className="inline h-4 w-4 mr-1 text-brand" /> Security</CardTitle>
              <CardDescription>Auth, isolation, and audit policies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <Row label="Auth" value="NextAuth.js (JWT, bcrypt)" />
              <Row label="Roles" value={<>{ROLES.map((r) => <RoleBadge key={r} role={r} className="mr-1 last:mr-0" />)}</>} />
              <Row label="Employee scope" value="Server-side userId filter on every API" />
              <Row label="Audit log" value="Every mutation written to AuditLog" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><Beaker className="inline h-4 w-4 mr-1 text-brand" /> Sandbox MIS</CardTitle>
              <CardDescription>Manager-only edit space.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Sandbox sessions are <strong>completely invisible</strong> to employees. Edits never modify real timesheets — they live in the SandboxEntry table tied to a label.</p>
              <Row label="Diff tags" value={<><Badge variant="success" className="mr-1">Added</Badge><Badge variant="warning" className="mr-1">Modified</Badge><Badge variant="danger">Removed</Badge></>} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><FileSpreadsheet className="inline h-4 w-4 mr-1 text-brand" /> Exports</CardTitle>
              <CardDescription>Excel and PDF generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <Row label="Excel" value="xlsx — matches original sheet columns" />
              <Row label="PDF" value="jsPDF + autotable" />
              <Row label="Columns" value="Month · Week · Date · Resource · Role · Client Code · Activity · Description · Hours · Type · Beeline Task · Task ID · PO Ref · Mins · SAT-FRI · Day Count" />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-500 shrink-0">{label}</span>
      <span className="text-right text-sm text-slate-700">{value}</span>
    </div>
  );
}
