import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-utils";

export async function GET(_req: NextRequest, ctx: { params: { label: string } }) {
  const access = await requirePermission("sandbox.view");
  if (access instanceof NextResponse) return access;
  const label = decodeURIComponent(ctx.params.label);

  const entries = await prisma.sandboxEntry.findMany({
    where: { sandboxLabel: label },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  // hydrate
  const userIds = [...new Set(entries.map((r) => r.userId))];
  const clientIds = [...new Set(entries.map((r) => r.clientId))];
  const activityIds = [...new Set(entries.map((r) => r.activityId))];
  const taskIds = [...new Set(entries.map((r) => r.taskId))];

  const [users, clients, activities, tasks] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, employeeCode: true } }),
    prisma.master.findMany({ where: { id: { in: clientIds } } }),
    prisma.activity.findMany({ where: { id: { in: activityIds } } }),
    prisma.task.findMany({ where: { id: { in: taskIds } } }),
  ]);

  const uMap = new Map(users.map((u) => [u.id, u]));
  const cMap = new Map(clients.map((c) => [c.id, c]));
  const aMap = new Map(activities.map((a) => [a.id, a]));
  const tMap = new Map(tasks.map((t) => [t.id, t]));

  const data = entries.map((e) => ({
    ...e,
    user: uMap.get(e.userId),
    client: cMap.get(e.clientId),
    activity: aMap.get(e.activityId),
    task: tMap.get(e.taskId),
  }));

  return NextResponse.json({ data, label });
}
