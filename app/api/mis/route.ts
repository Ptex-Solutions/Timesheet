import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, requirePermission } from "@/lib/api-utils";
import { generateMIS } from "@/lib/mis-engine";
import { misGenerateSchema } from "@/lib/validations";

export async function GET(_req: NextRequest) {
  const access = await requirePermission("mis.view");
  if (access instanceof NextResponse) return access;
  const data = await prisma.mISReport.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
    take: 100,
  });
  return NextResponse.json({ data });
}

// POST: generate (preview) or save final
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const finalize = !!body?.finalize;

  // Preview needs mis.edit; saving a final snapshot needs mis.finalize.
  const access = await requirePermission(finalize ? "mis.finalize" : "mis.edit");
  if (access instanceof NextResponse) return access;
  const { user, perms } = access;
  const title = String(body?.title ?? "MIS Report");

  const parsed = misGenerateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data;

  // Sandbox-sourced reports expose sandbox data, so also require sandbox.view.
  if (v.source === "sandbox" && !perms.has("sandbox.view")) {
    return NextResponse.json({ error: "Forbidden: missing sandbox.view" }, { status: 403 });
  }

  const mis = await generateMIS({
    source: v.source,
    sandboxLabel: v.sandboxLabel,
    dateFrom: new Date(v.dateFrom),
    dateTo: new Date(v.dateTo),
    employeeIds: v.employeeIds,
    clientIds: v.clientIds,
  });

  if (!finalize) {
    return NextResponse.json({ data: mis });
  }

  const report = await prisma.mISReport.create({
    data: {
      title,
      periodStart: new Date(v.dateFrom),
      periodEnd: new Date(v.dateTo),
      sandboxLabel: v.sandboxLabel ?? null,
      isFinal: true,
      createdById: user.id,
      data: mis as any,
    },
  });
  await audit({ userId: user.id, action: "finalize", entity: "MISReport", entityId: report.id, meta: { title } });

  return NextResponse.json({ data: { id: report.id, title } }, { status: 201 });
}
