import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { getCurrentAccess } from "@/lib/authz";
import { contractSchema } from "@/lib/validations";
import { ContractError, contractDetailInclude, contractTotals, saveContract } from "@/lib/contract-service";

// GET /api/contracts
//   contracts.view  -> full list with computed totals.
//   ?lite=1         -> ACTIVE contracts with their SOW tasks and roles only
//                      (no rates or amounts), for the Activity form; allowed
//                      with contracts.view or activities.edit. Optional
//                      &clientId= filter.
export async function GET(req: NextRequest) {
  const access = await getCurrentAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lite = req.nextUrl.searchParams.get("lite") === "1";

  const clientIdParam = req.nextUrl.searchParams.get("clientId");
  const clientId = clientIdParam ? parseId(clientIdParam) : null;
  if (clientIdParam && !clientId) return badRequest("Invalid clientId");

  if (lite) {
    if (!access.perms.has("contracts.view") && !access.perms.has("activities.edit")) {
      return NextResponse.json({ error: "Forbidden: missing contracts.view" }, { status: 403 });
    }
    const data = await prisma.contract.findMany({
      where: { status: "ACTIVE", ...(clientId ? { clientId } : {}) },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        description: true,
        clientId: true,
        tasks: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true, taskMaster: { select: { id: true, code: true, description: true } } },
        },
        rates: {
          orderBy: { id: "asc" },
          select: { resourceType: { select: { id: true, code: true, description: true } } },
        },
      },
    });
    // Roles are exposed (for Activity members) but never their rates.
    return NextResponse.json({
      data: data.map(({ rates, ...c }) => ({ ...c, roles: rates.map((r) => r.resourceType) })),
    });
  }

  if (!access.perms.has("contracts.view")) {
    return NextResponse.json({ error: "Forbidden: missing contracts.view" }, { status: 403 });
  }
  const rows = await prisma.contract.findMany({
    where: clientId ? { clientId } : {},
    orderBy: { code: "asc" },
    include: contractDetailInclude,
  });
  return NextResponse.json({ data: rows.map((c) => ({ ...c, totals: contractTotals(c) })) });
}

export async function POST(req: NextRequest) {
  const access = await requirePermission("contracts.edit");
  if (access instanceof NextResponse) return access;
  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = contractSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const created = await saveContract(parsed.data, { userId: access.user.id });
    const totals = contractTotals(created);
    await audit({
      userId: access.user.id,
      action: "contract.create",
      entity: "Contract",
      entityId: created.id,
      meta: { code: created.code, totalHours: totals.totalHours, totalAmount: totals.totalAmount },
    });
    return NextResponse.json({ data: { ...created, totals } }, { status: 201 });
  } catch (e) {
    if (e instanceof ContractError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
