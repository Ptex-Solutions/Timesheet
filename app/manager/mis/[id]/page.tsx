import { notFound, redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { MISCharts } from "./charts";

export default async function MISDetailPage({ params }: { params: { id: string } }) {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("mis.view")) redirect("/manager/dashboard");

  const id = parseInt(params.id, 10);
  const report = await prisma.mISReport.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!report) notFound();

  const data = report.data as any;

  return (
    <>
      <Topbar title={report.title} subtitle="Finalized MIS report" />
      <div className="p-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/mis"><ArrowLeft className="h-4 w-4" /> Back to reports</Link>
          </Button>
        </div>

        <PageHeader
          title={report.title}
          description={`${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)} · created by ${report.createdBy.name} on ${formatDate(report.createdAt)}`}
          actions={
            <div className="flex items-center gap-2">
              {report.sandboxLabel && <Badge variant="brand">Sandbox: {report.sandboxLabel}</Badge>}
              <Button asChild variant="outline">
                <a href={`/api/mis/${report.id}?format=xlsx`} download>
                  <Download className="h-4 w-4" /> Export Excel
                </a>
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Mini label="Rows" value={data.totals.totalRows} />
          <Mini label="Hours" value={data.totals.totalHours} />
          <Mini label="Employees" value={data.totals.employees} />
          <Mini label="Clients" value={data.totals.clients} />
        </div>

        <Tabs defaultValue="emp">
          <TabsList>
            <TabsTrigger value="emp">By Employee</TabsTrigger>
            <TabsTrigger value="cli">By Client</TabsTrigger>
            <TabsTrigger value="detail">Detailed</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
          </TabsList>

          <TabsContent value="emp">
            <Card>
              <table className="table-clean">
                <thead><tr><th>Employee</th><th className="text-right">Hours</th><th className="text-right">Mins</th><th className="text-right">Days</th></tr></thead>
                <tbody>
                  {data.byEmployee.map((e: any) => (
                    <tr key={e.userId}>
                      <td className="font-medium">{e.employee}</td>
                      <td className="text-right tabular-nums font-semibold">{Number(e.hours).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{e.minutes}</td>
                      <td className="text-right tabular-nums">{e.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="cli">
            <Card>
              <table className="table-clean">
                <thead><tr><th>Client</th><th>Name</th><th className="text-right">Hours</th><th className="text-right">Mins</th></tr></thead>
                <tbody>
                  {data.byClient.map((c: any) => (
                    <tr key={c.clientId}>
                      <td><span className="font-mono text-xs">{c.clientCode}</span></td>
                      <td>{c.clientName}</td>
                      <td className="text-right tabular-nums font-semibold">{Number(c.hours).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{c.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="detail">
            <Card>
              <div className="overflow-auto max-h-[70vh]">
                <table className="table-clean text-xs">
                  <thead>
                    <tr>
                      <th>Month</th><th>Week</th><th>Date</th><th>Resource</th><th>Client</th>
                      <th>Activity</th><th>Description</th><th className="text-right">Hours</th>
                      <th>Type</th><th>Task</th><th>PO Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r: any, i: number) => (
                      <tr key={i}>
                        <td>{r.month}</td>
                        <td className="font-mono">{r.weekLabel}</td>
                        <td>{r.date}</td>
                        <td className="font-mono">{r.resource}</td>
                        <td className="font-mono">{r.clientCode}</td>
                        <td className="font-mono">{r.activityId}</td>
                        <td className="max-w-xs truncate">{r.description}</td>
                        <td className="text-right tabular-nums font-semibold">{Number(r.hours).toFixed(2)}</td>
                        <td>{r.type}</td>
                        <td className="font-mono">{r.taskId}</td>
                        <td className="text-xs text-slate-500">{r.poRef ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="charts">
            <MISCharts data={data} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-navy tabular-nums">{value}</p>
    </div>
  );
}
