import { MasterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ContractDetail } from "@/lib/contract-service";
import type { ContractFormValue, ContractMasters } from "./editor";

// Masters the contract editor picks from (inactive ones included so a
// contract that already uses one still renders; the editor hides them from
// new selections).
export async function loadContractMasters(): Promise<ContractMasters> {
  const rows = await prisma.master.findMany({
    where: { type: { in: [MasterType.CLIENT, MasterType.CURRENCY, MasterType.RESOURCE_TYPE, MasterType.TASK] } },
    orderBy: { code: "asc" },
    select: { id: true, type: true, code: true, description: true, isActive: true },
  });
  const out: ContractMasters = { CLIENT: [], CURRENCY: [], RESOURCE_TYPE: [], TASK: [] };
  for (const { type, ...m } of rows) out[type as keyof ContractMasters].push(m);
  return out;
}

export function toFormValue(c: ContractDetail): ContractFormValue {
  return {
    id: c.id,
    status: c.status,
    code: c.code,
    description: c.description ?? "",
    clientId: String(c.clientId),
    currencyId: String(c.currencyId),
    rates: c.rates.map((r) => ({ resourceTypeId: String(r.resourceTypeId), ratePerHour: r.ratePerHour.toFixed(2) })),
    tasks: c.tasks.map((t) => ({
      taskMasterId: String(t.taskMasterId),
      hours: Object.fromEntries(t.budgets.map((b) => [String(b.resourceTypeId), b.hours.toFixed(2)])),
    })),
  };
}
