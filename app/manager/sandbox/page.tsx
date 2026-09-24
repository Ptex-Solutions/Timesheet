import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { ArrowRight, Beaker, PlusCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function SandboxIndexPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("sandbox.view")) redirect("/manager/dashboard");
  const canEdit = access.perms.has("sandbox.edit");

  const grouped = await prisma.sandboxEntry.groupBy({
    by: ["sandboxLabel"],
    _count: { id: true },
    _min: { date: true, createdAt: true },
    _max: { date: true, updatedAt: true },
  });

  const labels = grouped.map((g) => ({
    label: g.sandboxLabel,
    rows: g._count.id,
    dateFrom: g._min.date,
    dateTo: g._max.date,
    createdAt: g._min.createdAt,
    updatedAt: g._max.updatedAt,
  }));

  return (
    <>
      <Topbar title="Sandbox MIS" subtitle="Manipulate before finalizing" />
      <div className="p-6">
        <PageHeader
          title="Sandbox Sessions"
          description="Editable copies of timesheet data — invisible to employees. Reassign, add, remove, or adjust entries before finalizing into an MIS report."
          actions={
            canEdit ? (
              <Button asChild>
                <Link href="/manager/sandbox/new"><PlusCircle className="h-4 w-4" /> New Sandbox</Link>
              </Button>
            ) : undefined
          }
        />

        {labels.length === 0 && (
          <Card>
            <CardContent className="text-center py-16">
              <div className="mx-auto h-12 w-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center mb-4">
                <Beaker className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-semibold text-navy">No sandbox sessions yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Clone a date range of submitted timesheets into a sandbox label to start editing.
              </p>
              {canEdit && (
                <Button asChild className="mt-6">
                  <Link href="/manager/sandbox/new"><PlusCircle className="h-4 w-4" /> Create your first sandbox</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          {labels.map((l) => (
            <Card key={l.label} className="hover:shadow-elevated transition group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{l.label}</CardTitle>
                    <CardDescription>{l.rows} rows</CardDescription>
                  </div>
                  <Badge variant="brand">Sandbox</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Period</span>
                  <span>{formatDate(l.dateFrom)} – {formatDate(l.dateTo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last touched</span>
                  <span>{formatDate(l.updatedAt)}</span>
                </div>
                <Button asChild className="w-full mt-3" variant="outline">
                  <Link href={`/manager/sandbox/${encodeURIComponent(l.label)}`}>
                    Open <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
