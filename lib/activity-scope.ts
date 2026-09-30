import { Prisma } from "@prisma/client";

// An Activity's "scope": the Contract it executes, which of that contract's
// SOW tasks it delivers, and who may log time on it at which billing role.
//
// Invariants enforced here (all inside the caller's transaction):
// - the contract exists, is ACTIVE and belongs to the Activity's client;
// - every selected ContractTask belongs to that contract (never a task of an
//   unrelated contract);
// - every member's resource type has a rate on that contract;
// - a task row that already carries timesheet/sandbox history can't be
//   unselected (deleted); it can only be marked inactive, so historical
//   entries keep their meaning. Selecting and active/inactive are separate:
//   a selected task keeps its current active flag unless `taskActive` sets it.

export class ScopeError extends Error {}

export type ActivityScopeInput = {
  contractId: number;
  contractTaskIds: number[];
  // Optional active flag per selected contractTaskId; omitted lines keep
  // their current flag (new ones start active).
  taskActive?: Record<number, boolean>;
  members: { userId: number; resourceTypeId: number; isActive?: boolean }[];
};

export type ScopeResult = {
  added: string[];
  reactivated: string[];
  deactivated: string[];
  removed: string[];
  mappedLegacy: string[];
  members: number;
};

async function taskUsage(tx: Prisma.TransactionClient, taskIds: number[]): Promise<Set<number>> {
  if (taskIds.length === 0) return new Set();
  const [ts, sb] = await Promise.all([
    tx.timesheet.groupBy({ by: ["taskId"], where: { taskId: { in: taskIds } } }),
    tx.sandboxEntry.groupBy({ by: ["taskId"], where: { taskId: { in: taskIds } } }),
  ]);
  return new Set([...ts.map((r) => r.taskId), ...sb.map((r) => r.taskId)]);
}

export async function applyActivityScope(
  tx: Prisma.TransactionClient,
  activityId: number,
  input: ActivityScopeInput
): Promise<ScopeResult> {
  const activity = await tx.activity.findUniqueOrThrow({
    where: { id: activityId },
    include: { tasks: true },
  });
  const contract = await tx.contract.findUnique({
    where: { id: input.contractId },
    include: { tasks: { include: { taskMaster: true } }, rates: true },
  });
  if (!contract) throw new ScopeError("Contract not found");
  if (contract.status !== "ACTIVE") throw new ScopeError(`Contract ${contract.code} is not active`);
  if (contract.clientId !== activity.clientId) {
    throw new ScopeError(`Contract ${contract.code} belongs to a different client than this Activity`);
  }

  const wanted = [...new Set(input.contractTaskIds)];
  if (wanted.length === 0) throw new ScopeError("Select at least one task from the contract");
  const contractTasks = new Map(contract.tasks.map((t) => [t.id, t]));
  for (const id of wanted) {
    if (!contractTasks.has(id)) throw new ScopeError(`Task ${id} is not part of contract ${contract.code}`);
  }

  const used = await taskUsage(tx, activity.tasks.map((t) => t.id));
  const result: ScopeResult = { added: [], reactivated: [], deactivated: [], removed: [], mappedLegacy: [], members: 0 };

  // Switching an Activity from one contract to another is only safe while no
  // time has been logged on it (history would silently change contract).
  if (activity.contractId !== null && activity.contractId !== contract.id) {
    if (used.size > 0) {
      throw new ScopeError("The contract cannot change after time has been logged on this Activity");
    }
    await tx.task.deleteMany({ where: { activityId } });
    activity.tasks = [];
  }

  // Tasks of this activity that point at another contract's line can only
  // exist after a switch, which cleared them above. What remains is either
  // this contract's lines or legacy (pre-contract) free-text tasks.
  const byLine = new Map<number, (typeof activity.tasks)[number]>();
  const legacy: (typeof activity.tasks)[number][] = [];
  for (const t of activity.tasks) {
    if (t.contractTaskId !== null) byLine.set(t.contractTaskId, t);
    else legacy.push(t);
  }

  // Attach legacy tasks to a selected SOW line with the same code, keeping
  // their ids (and therefore their timesheet history).
  const wantedSet = new Set(wanted);
  for (const t of legacy) {
    const line = contract.tasks.find(
      (ct) => wantedSet.has(ct.id) && !byLine.has(ct.id) && ct.taskMaster.code === t.taskId.trim().toUpperCase()
    );
    if (line) {
      await tx.task.update({ where: { id: t.id }, data: { contractTaskId: line.id, isActive: true } });
      byLine.set(line.id, { ...t, contractTaskId: line.id, isActive: true });
      result.mappedLegacy.push(t.taskId);
    } else if (used.has(t.id)) {
      if (t.isActive) {
        await tx.task.update({ where: { id: t.id }, data: { isActive: false } });
        result.deactivated.push(t.taskId);
      }
    } else {
      await tx.task.delete({ where: { id: t.id } });
      result.removed.push(t.taskId);
    }
  }

  for (const [lineId, t] of byLine) {
    if (wantedSet.has(lineId)) continue;
    if (used.has(t.id)) {
      throw new ScopeError(`${t.taskId} has logged time, so it can't be removed. Mark it inactive instead.`);
    }
    await tx.task.delete({ where: { id: t.id } });
    result.removed.push(t.taskId);
  }

  for (const id of wanted) {
    const existing = byLine.get(id);
    const master = contractTasks.get(id)!.taskMaster;
    const want = input.taskActive?.[id];
    if (!existing) {
      await tx.task.create({
        data: {
          activityId,
          contractTaskId: id,
          taskId: master.code,
          taskName: master.description ?? master.code,
          isActive: want ?? true,
        },
      });
      result.added.push(master.code);
    } else if (want !== undefined && want !== existing.isActive) {
      await tx.task.update({ where: { id: existing.id }, data: { isActive: want } });
      (want ? result.reactivated : result.deactivated).push(master.code);
    }
  }

  // --- members ---
  const roles = new Set(contract.rates.map((r) => r.resourceTypeId));
  const seen = new Set<number>();
  for (const m of input.members) {
    if (seen.has(m.userId)) throw new ScopeError("Each person can be added to an Activity only once");
    seen.add(m.userId);
    if (!roles.has(m.resourceTypeId)) {
      throw new ScopeError(`Member role must be one of the roles priced on contract ${contract.code}`);
    }
  }
  if (seen.size) {
    const users = await tx.user.findMany({ where: { id: { in: [...seen] } }, select: { id: true, isActive: true } });
    if (users.length !== seen.size) throw new ScopeError("Unknown member");
  }
  await tx.activityMember.deleteMany({ where: { activityId } });
  if (input.members.length) {
    await tx.activityMember.createMany({
      data: input.members.map((m) => ({
        activityId,
        userId: m.userId,
        resourceTypeId: m.resourceTypeId,
        isActive: m.isActive ?? true,
      })),
    });
  }
  result.members = input.members.filter((m) => m.isActive !== false).length;

  await tx.activity.update({ where: { id: activityId }, data: { contractId: contract.id } });
  return result;
}
