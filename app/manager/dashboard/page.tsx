import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Clock, Users, FileSpreadsheet, ArrowRight, BarChart3, LayoutDashboard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/utils";
import { HoursByClientChart } from "@/components/manager/hours-chart";

async function loadTimesheetKpis() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [monthHours, pending, byClient, recent] = await Promise.all([
    prisma.timesheet.aggregate({
      where: { date: { gte: monthStart, lt: monthEnd } },
      _sum: { hours: true },
      _count: true,
    }),
    prisma.timesheet.count({ where: { status: "SUBMITTED" } }),
    prisma.timesheet.groupBy({
      by: ["clientId"],
      where: { date: { gte: monthStart, lt: monthEnd } },
      _sum: { hours: true },
    }),
    prisma.timesheet.findMany({
      where: { status: "SUBMITTED" },
      include: { user: true, client: true, project: true, task: true },
      orderBy: { submittedAt: "desc" },
      take: 6,
    }),
  ]);

  const clientIds = byClient.map((b) => b.clientId);
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds } } });
  const cMap = new Map(clients.map((c) => [c.id, c.clientCode]));
  const chartData = byClient
    .map((b) => ({ name: cMap.get(b.clientId) ?? "?", hours: Number(b._sum.hours ?? 0) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  return {
    monthHours: Number(monthHours._sum.hours ?? 0),
    monthEntries: monthHours._count,
    pending,
    activeClients: byClient.length,
    chartData,
    recent,
  };
}

export default async function ManagerDashboard() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login");
  const { perms } = access;

  const canTimesheets = perms.has("timesheets.view");
  const canSandbox = perms.has("sandbox.view");
  // /manager/mis/generate itself requires mis.edit; view-only users get a
  // link to the reports list instead of a button that would bounce them.
  const canGenerateMis = perms.has("mis.edit");
  const canViewMis = perms.has("mis.view");
  const canEmployees = perms.has("employees.view");
  const canClients = perms.has("clients.view");

  // Only query what the viewer may see — never fetch then hide.
  const [kpis, activeUsers] = await Promise.all([
    canTimesheets ? loadTimesheetKpis() : Promise.resolve(null),
    canEmployees
      ? prisma.user.count({ where: { isActive: true, role: "EMPLOYEE" } })
      : Promise.resolve(null),
  ]);

  const hasStats = kpis !== null || activeUsers !== null;
  const hasQuickLinks = canTimesheets || canSandbox || canEmployees || canClients;
  const hasHeaderActions = canSandbox || canGenerateMis || canViewMis;
  const nothingVisible = !hasStats && !hasQuickLinks && !hasHeaderActions;

  return (
    <>
      <Topbar title="Manager Dashboard" subtitle="Operations overview" />
      <div className="p-6">
        <PageHeader
          title="Operations Overview"
          description="KPIs across the organization for the current period."
          actions={
            hasHeaderActions ? (
              <>
                {canSandbox && (
                  <Button variant="outline" asChild>
                    <Link href="/manager/sandbox"><BarChart3 className="h-4 w-4" /> Sandbox</Link>
                  </Button>
                )}
                {canGenerateMis ? (
                  <Button asChild>
                    <Link href="/manager/mis/generate">Generate MIS <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                ) : canViewMis ? (
                  <Button asChild>
                    <Link href="/manager/mis">MIS Reports <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                ) : null}
              </>
            ) : undefined
          }
        />

        {nothingVisible && (
          <Card>
            <CardContent className="flex flex-col items-center text-center py-16">
              <div className="h-12 w-12 rounded-lg bg-brand-gradient flex items-center justify-center text-white">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-navy mt-4">Nothing to show yet</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md">
                Your account doesn&apos;t have access to any dashboard modules yet. Ask an administrator to grant
                you the permissions you need.
              </p>
            </CardContent>
          </Card>
        )}

        {hasStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeUsers !== null && (
              <StatCard label="Active Employees" value={activeUsers} icon={Users} accent="navy" />
            )}
            {kpis && (
              <>
                <StatCard label="Hours This Month" value={kpis.monthHours.toFixed(0)} icon={Clock} accent="brand" hint={`${kpis.monthEntries} entries`} />
                <StatCard label="Pending Approval" value={kpis.pending} icon={FileSpreadsheet} accent="amber" hint="Submitted timesheets" />
                <StatCard label="Active Clients" value={kpis.activeClients} icon={Building2} accent="emerald" />
              </>
            )}
          </div>
        )}

        {(kpis || hasQuickLinks) && (
          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${hasStats ? "mt-6" : ""}`}>
            {kpis && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Hours by Client (this month)</CardTitle>
                  <CardDescription>Total hours logged across active clients</CardDescription>
                </CardHeader>
                <CardContent>
                  {kpis.chartData.length > 0 ? (
                    <HoursByClientChart data={kpis.chartData} />
                  ) : (
                    <div className="text-sm text-slate-400 text-center py-12">No data this month yet.</div>
                  )}
                </CardContent>
              </Card>
            )}

            {hasQuickLinks && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {canTimesheets && (
                    <Button asChild className="w-full justify-start" variant="outline">
                      <Link href="/manager/timesheets"><FileSpreadsheet className="h-4 w-4" /> All Timesheets</Link>
                    </Button>
                  )}
                  {canSandbox && (
                    <Button asChild className="w-full justify-start" variant="outline">
                      <Link href="/manager/sandbox"><BarChart3 className="h-4 w-4" /> Sandbox MIS</Link>
                    </Button>
                  )}
                  {canEmployees && (
                    <Button asChild className="w-full justify-start" variant="outline">
                      <Link href="/manager/employees"><Users className="h-4 w-4" /> Employees</Link>
                    </Button>
                  )}
                  {canClients && (
                    <Button asChild className="w-full justify-start" variant="outline">
                      <Link href="/manager/clients"><Building2 className="h-4 w-4" /> Clients & Projects</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {kpis && (
          <Card className="mt-6">
            <CardHeader className="flex-row items-center justify-between flex">
              <div>
                <CardTitle>Approval Queue</CardTitle>
                <CardDescription>Latest timesheets awaiting review</CardDescription>
              </div>
              {kpis.pending > 0 && <Badge variant="warning">{kpis.pending} pending</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Employee</th>
                    <th>Client</th>
                    <th>Activity</th>
                    <th>Description</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.recent.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">No pending submissions.</td></tr>
                  )}
                  {kpis.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs">{formatDate(r.submittedAt ?? r.date)}</td>
                      <td>
                        <p className="font-medium">{r.user.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{r.user.employeeCode}</p>
                      </td>
                      <td><span className="font-mono text-xs">{r.client.clientCode}</span></td>
                      <td>
                        <p className="font-mono text-xs">{r.project.activityId}</p>
                        <p className="text-xs text-slate-500">{r.task.taskId}</p>
                      </td>
                      <td className="max-w-xs truncate">{r.description}</td>
                      <td className="font-semibold tabular-nums">{Number(r.hours).toFixed(2)}</td>
                      <td><StatusPill status={r.status} /></td>
                      <td className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/manager/timesheets/${r.id}`}>Review <ArrowRight className="h-3 w-3" /></Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
