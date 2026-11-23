import { NextRequest, NextResponse } from "next/server";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { contractStatusActionSchema } from "@/lib/validations";
import { ContractError, transitionContract } from "@/lib/contract-service";

// POST { action: "activate" | "close" | "reopen" }
// activate needs contracts.edit; close and reopen need contracts.delete.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = contractStatusActionSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid action", parsed.error.flatten());
  const { action } = parsed.data;

  const access = await requirePermission(action === "activate" ? "contracts.edit" : "contracts.delete");
  if (access instanceof NextResponse) return access;
  const id = parseId(params.id);
  if (!id) return badRequest("Invalid id");

  try {
    const updated = await transitionContract(id, action);
    await audit({
      userId: access.user.id,
      action: `contract.${action}`,
      entity: "Contract",
      entityId: id,
      meta: { code: updated.code, status: updated.status },
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    if (e instanceof ContractError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
