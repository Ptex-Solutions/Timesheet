import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { ArrowRight, BarChart3, Download, PlusCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function MISIndexPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("mis.view")) redirect("/admin/dashboard");

  const reports = await prisma.mISReport.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
    take: 50,
  });

  return (
    <>
      <Topbar title="MIS Reports" subtitle="Finalized snapshots" />
      <div className="p-6">
        <PageHeader
          title="MIS Reports"
          description="All finalized MIS reports. Generate new ones from timesheets or sandbox sessions."
          actions={
            access.perms.has("mis.edit") ? (
              <Button asChild>
                <Link href="/admin/mis/generate"><PlusCircle className="h-4 w-4" /> Generate MIS</Link>
              </Button>
            ) : undefined
          }
        />

        <Card>
          <table className="table-clean">
            <thead>
              <tr>
                <th>Title</th>
                <th>Period</th>
                <th>Source</th>
                <th>Created by</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No MIS reports yet.</td></tr>
              )}
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.title}</td>
                  <td className="text-xs">{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</td>
                  <td>
                    {r.sandboxLabel ? (
                      <Badge variant="brand">Sandbox: {r.sandboxLabel}</Badge>
                    ) : (
                      <Badge variant="info">Timesheets</Badge>
                    )}
                  </td>
                  <td className="text-xs">{r.createdBy.name}</td>
                  <td className="text-xs">{formatDate(r.createdAt)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <a href={`/api/mis/${r.id}?format=xlsx`}><Download className="h-3.5 w-3.5" /> Excel</a>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/mis/${r.id}`}>Open <ArrowRight className="h-3.5 w-3.5" /></Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
