import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, requirePermission, requireUser } from "@/lib/api-utils";
import { clientSchema } from "@/lib/validations";

export async function GET(_req: NextRequest) {
  // both roles need clients to render dropdowns
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const data = await prisma.client.findMany({
    where: { isActive: true },
    orderBy: { clientCode: "asc" },
    include: {
      projects: {
        where: { isActive: true },
        include: { tasks: { where: { isActive: true } } },
      },
    },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const body = await req.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const created = await prisma.client.create({ data: parsed.data });
  await audit({ userId: user.id, action: "create", entity: "Client", entityId: created.id });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const access = await requirePermission("clients.edit");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const body = await req.json();
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const parsed = clientSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const updated = await prisma.client.update({ where: { id }, data: parsed.data });
  await audit({ userId: user.id, action: "update", entity: "Client", entityId: id });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePermission("clients.delete");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.client.update({ where: { id }, data: { isActive: false } });
  await audit({ userId: user.id, action: "deactivate", entity: "Client", entityId: id });
  return NextResponse.json({ ok: true });
}
