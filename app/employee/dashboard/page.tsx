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
import { WeeklyGrid } from "@/components/employee/weekly-grid";
import { TimesheetTable } from "../timesheet/timesheet-table";
import { latestEntryHint, timesheetRowInclude, toTimesheetRow } from "../timesheet/rows";
import { weekLabelForDate } from "@/lib/utils";

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

  const [weekly, monthly, weekRows, statuses, dateHints] = await Promise.all([
    prisma.timesheet.findMany({
      where: { userId, date: { gte: weekStart, lt: weekEnd } },
      select: { sat: true, sun: true, mon: true, tue: true, wed: true, thu: true, fri: true, hours: true },
    }),
    prisma.timesheet.aggregate({
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { hours: true },
      _count: true,
    }),
    // This week's entries (Sat–Fri) for the editable table.
    prisma.timesheet.findMany({
      where: { userId, date: { gte: weekStart, lt: weekEnd } },
      include: timesheetRowInclude,
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.timesheet.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    latestEntryHint(userId),
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

        <div className="mt-6">
          <div className="flex items-end justify-between gap-2 mb-2">
            <div>
              <h3 className="font-display text-lg font-bold text-navy">This Week&apos;s Entries</h3>
              <p className="text-sm text-slate-500">{weekLabelForDate(now)} · add, clone, edit or submit right here</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/employee/timesheet">View all</Link>
            </Button>
          </div>
          <TimesheetTable
            rows={weekRows.map(toTimesheetRow)}
            dateHints={dateHints}
            emptyText="Nothing logged this week yet."
          />
        </div>
      </div>
    </>
  );
}
