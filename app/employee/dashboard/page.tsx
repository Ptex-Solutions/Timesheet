import Link from "next/link";
import { Activity, Clock, FileSpreadsheet, PlusCircle, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { WeeklyGrid } from "@/components/employee/weekly-grid";
import { formatDate, weekLabelForDate } from "@/lib/utils";

export default async function EmployeeDashboard() {
  const session = await auth();
  const userId = session!.user.id;

  const now = new Date();
  const day = now.getDay();
  const diff = (day + 1) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [weekly, monthly, recent, statuses] = await Promise.all([
    prisma.timesheet.findMany({
      where: { userId, date: { gte: weekStart, lt: weekEnd } },
      select: { sat: true, sun: true, mon: true, tue: true, wed: true, thu: true, fri: true, hours: true },
    }),
    prisma.timesheet.aggregate({
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { hours: true },
      _count: true,
    }),
    prisma.timesheet.findMany({
      where: { userId },
      include: { client: true, activity: true, task: true },
      orderBy: { date: "desc" },
      take: 6,
    }),
    prisma.timesheet.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const weekTotal = weekly.reduce((s, r) => s + Number(r.hours), 0);
  const target = 40;
  const pct = Math.min(100, (weekTotal / target) * 100);

  const submittedCount = statuses.find((s) => s.status === "SUBMITTED")?._count._all ?? 0;
  const approvedCount = statuses.find((s) => s.status === "APPROVED")?._count._all ?? 0;
  const draftCount = statuses.find((s) => s.status === "DRAFT")?._count._all ?? 0;

  return (
    <>
      <Topbar
        title={`Hello, ${session!.user.name?.split(" ")[0]}`}
        subtitle={`Week of ${weekLabelForDate(now)} · ${session!.user.employeeCode}`}
      />
      <div className="p-6">
        <PageHeader
          title="My Dashboard"
          description="Your weekly timesheet snapshot and submission status."
          actions={
            <Button asChild>
              <Link href="/employee/timesheet?add=1">
                <PlusCircle className="h-4 w-4" /> New Entry
              </Link>
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="This Week"
            value={`${weekTotal.toFixed(1)}h`}
            icon={Clock}
            accent="brand"
            hint={`Target: ${target}h`}
          />
          <StatCard
            label="This Month"
            value={`${Number(monthly._sum.hours ?? 0).toFixed(1)}h`}
            icon={TrendingUp}
            accent="navy"
            hint={`${monthly._count} entries`}
          />
          <StatCard
            label="Submitted"
            value={submittedCount}
            icon={Activity}
            accent="sky"
            hint="Awaiting approval"
          />
          <StatCard
            label="Approved"
            value={approvedCount}
            icon={FileSpreadsheet}
            accent="emerald"
            hint={`Drafts: ${draftCount}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>This Week (Sat–Fri)</CardTitle>
              <CardDescription>Daily breakdown · {weekTotal.toFixed(2)}h of {target}h target</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={pct} className="mb-4" />
              <WeeklyGrid rows={weekly as any} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start" variant="outline">
                <Link href="/employee/timesheet?add=1"><PlusCircle className="h-4 w-4" /> Log new entry</Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link href="/employee/timesheet"><FileSpreadsheet className="h-4 w-4" /> View all timesheets</Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link href="/employee/profile"><Activity className="h-4 w-4" /> My profile</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between flex">
            <div>
              <CardTitle>Recent Entries</CardTitle>
              <CardDescription>Your last 6 timesheet rows</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/employee/timesheet">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Activity</th>
                  <th>Description</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No timesheets yet. Click <span className="font-semibold text-brand">New Entry</span> to log your first.
                    </td>
                  </tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{formatDate(r.date)}</td>
                    <td><span className="font-mono text-xs">{r.client.code}</span></td>
                    <td>
                      <p className="text-xs font-mono text-slate-500">{r.activity.activityId}</p>
                      <p className="text-xs">{r.task.taskId}</p>
                    </td>
                    <td className="max-w-md truncate">{r.description}</td>
                    <td className="font-semibold tabular-nums">{Number(r.hours).toFixed(2)}</td>
                    <td><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
