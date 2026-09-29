import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { contractSchema } from "@/lib/validations";
import { ContractError, contractDetailInclude, contractTotals, saveContract } from "@/lib/contract-service";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requirePermission("contracts.view");
  if (access instanceof NextResponse) return access;
  const id = parseId(params.id);
  if (!id) return badRequest("Invalid id");
  const c = await prisma.contract.findUnique({ where: { id }, include: contractDetailInclude });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: { ...c, totals: contractTotals(c) } });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const access = await requirePermission("contracts.edit");
  if (access instanceof NextResponse) return access;
  const id = parseId(params.id);
  if (!id) return badRequest("Invalid id");
  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = contractSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const before = await prisma.contract.findUnique({ where: { id }, include: contractDetailInclude });
    const updated = await saveContract(parsed.data, { id, userId: access.user.id });
    const totals = contractTotals(updated);
    const beforeTotals = before ? contractTotals(before) : null;
    await audit({
      userId: access.user.id,
      action: "contract.update",
      entity: "Contract",
      entityId: id,
      meta: {
        code: updated.code,
        status: updated.status,
        before: beforeTotals && { totalHours: beforeTotals.totalHours, totalAmount: beforeTotals.totalAmount },
        after: { totalHours: totals.totalHours, totalAmount: totals.totalAmount },
      },
    });
    return NextResponse.json({ data: { ...updated, totals } });
  } catch (e) {
    if (e instanceof ContractError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

// Only DRAFT contracts can be hard-deleted: Activities can only reference
// ACTIVE contracts, and a contract never returns to DRAFT, so a draft is never
// referenced. Active contracts are closed instead, preserving history.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requirePermission("contracts.delete");
  if (access instanceof NextResponse) return access;
  const id = parseId(params.id);
  if (!id) return badRequest("Invalid id");
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "DRAFT") {
    return badRequest("Only draft contracts can be deleted. Close an active contract instead.");
  }
  // Rates, tasks and budgets cascade. The status filter makes this atomic
  // against a concurrent activation.
  const deleted = await prisma.contract.deleteMany({ where: { id, status: "DRAFT" } });
  if (deleted.count === 0) return badRequest("Contract is no longer a draft");
  await audit({ userId: access.user.id, action: "contract.delete", entity: "Contract", entityId: id, meta: { code: c.code } });
  return NextResponse.json({ ok: true });
}
