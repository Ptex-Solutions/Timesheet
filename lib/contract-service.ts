import { MasterType, Prisma, type ContractStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeContractTotals, validateContractGrid, type ContractCalcInput } from "@/lib/contract-calc";
import type { z } from "zod";
import type { contractSchema } from "@/lib/validations";

export type ContractInput = z.infer<typeof contractSchema>;

// Business-rule violation → 400 with this message (routes check instanceof).
export class ContractError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const MASTER_BRIEF = { select: { id: true, code: true, description: true, isActive: true } } as const;

export const contractDetailInclude = {
  client: MASTER_BRIEF,
  currency: MASTER_BRIEF,
  createdBy: { select: { id: true, name: true } },
  rates: { include: { resourceType: MASTER_BRIEF }, orderBy: { id: "asc" } },
  tasks: {
    include: { taskMaster: MASTER_BRIEF, budgets: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ContractInclude;

export type ContractDetail = Prisma.ContractGetPayload<{ include: typeof contractDetailInclude }>;

// Rates/budgets as loaded from the DB → the pure calculator's input shape.
export function contractCalcInput(c: {
  rates: { resourceTypeId: number; ratePerHour: Prisma.Decimal }[];
  tasks: { taskMasterId: number; budgets: { resourceTypeId: number; hours: Prisma.Decimal }[] }[];
}): ContractCalcInput {
  return {
    rates: c.rates.map((r) => ({ resourceTypeId: r.resourceTypeId, ratePerHour: r.ratePerHour.toFixed(2) })),
    tasks: c.tasks.map((t) => ({
      taskMasterId: t.taskMasterId,
      hours: Object.fromEntries(t.budgets.map((b) => [b.resourceTypeId, b.hours.toFixed(2)])),
    })),
  };
}

export function contractTotals(c: Parameters<typeof contractCalcInput>[0]) {
  return computeContractTotals(contractCalcInput(c));
}

// Every referenced master must exist, be of the right category, and be
// active — except ids the contract already uses (a master deactivated after
// it was put on the contract may stay; it just can't be newly added).
async function checkMasters(
  tx: Prisma.TransactionClient,
  ids: number[],
  type: MasterType,
  label: string,
  keep: Set<number>
) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await tx.master.findMany({ where: { id: { in: unique } } });
  const byId = new Map(rows.map((m) => [m.id, m]));
  for (const id of unique) {
    const m = byId.get(id);
    if (!m || m.type !== type) throw new ContractError(`${label} ${id} is not a valid ${label} master`);
    if (!m.isActive && !keep.has(id)) throw new ContractError(`${label} ${m.code} is inactive`);
  }
}

function assertGrid(input: ContractInput) {
  const errors = validateContractGrid(input);
  if (errors.length) throw new ContractError(errors[0]);
}

// Creates or updates a contract with its rates, SOW tasks and budgets in one
// transaction. Existing ContractTask / ContractRate rows are kept (matched by
// task / role) so their ids stay stable for Activity task assignments; only
// removed ones are deleted. Budget rows have no outside references and are
// rewritten wholesale.
export async function saveContract(
  input: ContractInput,
  opts: { id?: number; userId: number }
): Promise<ContractDetail> {
  assertGrid(input);

  return prisma.$transaction(async (tx) => {
    let existing: ContractDetail | null = null;
    if (opts.id) {
      // Row lock so two concurrent saves of the same contract serialise.
      await tx.$queryRaw`SELECT id FROM Contract WHERE id = ${opts.id} FOR UPDATE`;
      existing = await tx.contract.findUnique({ where: { id: opts.id }, include: contractDetailInclude });
      if (!existing) throw new ContractError("Contract not found", 404);
      if (existing.status === "CLOSED") throw new ContractError("A closed contract is read-only — re-open it first");
      if (existing.status === "ACTIVE") {
        if (input.code !== existing.code) throw new ContractError("SOW Code cannot change once the contract is active");
        if (input.clientId !== existing.clientId) throw new ContractError("Client cannot change once the contract is active");
        if (input.currencyId !== existing.currencyId) throw new ContractError("Currency cannot change once the contract is active");
      }
    }

    const keepRoles = new Set(existing?.rates.map((r) => r.resourceTypeId) ?? []);
    const keepTasks = new Set(existing?.tasks.map((t) => t.taskMasterId) ?? []);
    await Promise.all([
      checkMasters(tx, [input.clientId], MasterType.CLIENT, "Client", new Set(existing ? [existing.clientId] : [])),
      checkMasters(tx, [input.currencyId], MasterType.CURRENCY, "Currency", new Set(existing ? [existing.currencyId] : [])),
      checkMasters(tx, input.rates.map((r) => r.resourceTypeId), MasterType.RESOURCE_TYPE, "Resource Type", keepRoles),
      checkMasters(tx, input.tasks.map((t) => t.taskMasterId), MasterType.TASK, "Task", keepTasks),
    ]);

    const header = {
      code: input.code,
      description: input.description?.trim() || null,
      clientId: input.clientId,
      currencyId: input.currencyId,
    };

    let contractId: number;
    try {
      if (existing) {
        await tx.contract.update({ where: { id: existing.id }, data: header });
        contractId = existing.id;
      } else {
        const created = await tx.contract.create({ data: { ...header, createdById: opts.userId } });
        contractId = created.id;
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ContractError(`SOW Code ${input.code} already exists`, 409);
      }
      throw e;
    }

    // --- rates: upsert kept/new, delete removed ---
    const newRoles = new Set(input.rates.map((r) => r.resourceTypeId));
    const removedRoles = [...keepRoles].filter((id) => !newRoles.has(id));
    const removedTaskIds = (existing?.tasks ?? [])
      .filter((t) => !input.tasks.some((x) => x.taskMasterId === t.taskMasterId))
      .map((t) => t.id);
    await assertRemovable(tx, contractId, removedRoles, removedTaskIds);

    if (removedRoles.length) {
      await tx.contractRate.deleteMany({ where: { contractId, resourceTypeId: { in: removedRoles } } });
    }
    for (const r of input.rates) {
      const ratePerHour = new Prisma.Decimal(String(r.ratePerHour).trim());
      await tx.contractRate.upsert({
        where: { contractId_resourceTypeId: { contractId, resourceTypeId: r.resourceTypeId } },
        update: { ratePerHour },
        create: { contractId, resourceTypeId: r.resourceTypeId, ratePerHour },
      });
    }

    // --- tasks: keep ids stable, rewrite budgets ---
    if (removedTaskIds.length) {
      await tx.contractTask.deleteMany({ where: { id: { in: removedTaskIds } } });
    }
    for (const [i, t] of input.tasks.entries()) {
      const ct = await tx.contractTask.upsert({
        where: { contractId_taskMasterId: { contractId, taskMasterId: t.taskMasterId } },
        update: { sortOrder: i },
        create: { contractId, taskMasterId: t.taskMasterId, sortOrder: i },
      });
      await tx.contractTaskBudget.deleteMany({ where: { contractTaskId: ct.id } });
      const budgets = Object.entries(t.hours)
        .filter(([, h]) => h !== undefined && h !== "" && Number(h) !== 0)
        .map(([role, h]) => ({
          contractTaskId: ct.id,
          resourceTypeId: Number(role),
          hours: new Prisma.Decimal(String(h).trim()),
        }));
      if (budgets.length) await tx.contractTaskBudget.createMany({ data: budgets });
    }

    return tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: contractDetailInclude });
  }, { timeout: 20_000 });
}

// Removing a role or SOW task from a contract must not orphan anything that
// already depends on it (Activity task assignments / members). Extended when
// those relations exist.
async function assertRemovable(
  _tx: Prisma.TransactionClient,
  _contractId: number,
  _removedRoleIds: number[],
  _removedContractTaskIds: number[]
) {}

// Lifecycle: DRAFT → ACTIVE → CLOSED, CLOSED → ACTIVE (re-open).
export const CONTRACT_TRANSITIONS: Record<"activate" | "close" | "reopen", { from: ContractStatus; to: ContractStatus }> = {
  activate: { from: "DRAFT", to: "ACTIVE" },
  close: { from: "ACTIVE", to: "CLOSED" },
  reopen: { from: "CLOSED", to: "ACTIVE" },
};

export async function transitionContract(id: number, action: keyof typeof CONTRACT_TRANSITIONS) {
  const { from, to } = CONTRACT_TRANSITIONS[action];
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Contract WHERE id = ${id} FOR UPDATE`;
    const c = await tx.contract.findUnique({
      where: { id },
      include: { rates: true, tasks: { include: { budgets: true } } },
    });
    if (!c) throw new ContractError("Contract not found", 404);
    if (c.status !== from) {
      throw new ContractError(`Cannot ${action} a contract that is ${c.status.toLowerCase()}`);
    }
    if (action === "activate") {
      if (c.rates.length === 0) throw new ContractError("Add at least one role rate before activating");
      if (c.tasks.length === 0) throw new ContractError("Add at least one task before activating");
    }
    return tx.contract.update({
      where: { id },
      data: {
        status: to,
        ...(to === "ACTIVE" && action === "activate" ? { activatedAt: new Date() } : {}),
        ...(to === "CLOSED" ? { closedAt: new Date() } : { closedAt: null }),
      },
    });
  });
}
