import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, requirePermission, requireUser } from "@/lib/api-utils";
import { taskSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const projectId = req.nextUrl.searchParams.get("projectId");
  const data = await prisma.task.findMany({
    where: { isActive: true, ...(projectId ? { projectId: parseInt(projectId, 10) } : {}) },
    orderBy: { taskId: "asc" },
    include: { project: { include: { client: true } } },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const body = await req.json();
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const created = await prisma.task.create({ data: { ...parsed.data, poRef: parsed.data.poRef ?? null } });
  await audit({ userId: user.id, action: "create", entity: "Task", entityId: created.id });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const body = await req.json();
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const parsed = taskSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const updated = await prisma.task.update({ where: { id }, data: parsed.data });
  await audit({ userId: user.id, action: "update", entity: "Task", entityId: id });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("clients.delete");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.task.update({ where: { id }, data: { isActive: false } });
  await audit({ userId: user.id, action: "deactivate", entity: "Task", entityId: id });
  return NextResponse.json({ ok: true });
}
