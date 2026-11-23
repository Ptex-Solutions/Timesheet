import { MasterType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyActivityScope, type ScopeResult } from "@/lib/activity-scope";

// Moves pre-contract (V1) Activities onto Contracts without losing history.
// Legacy free-text tasks keep their ids: each one gets a TASK master and a
// line on the contract with the same code, and applyActivityScope links them.
// Idempotent: only Activities with contractId = null are touched.

type Member = { userId: number; resourceTypeId: number };

const CODE_OK = /^[A-Z0-9][A-Z0-9._\/-]*$/;
export function legacyContractCode(poRef: string | null | undefined, activityCode: string): string {
  const po = poRef?.trim().toUpperCase().replace(/\s+/g, "-");
  if (po && CODE_OK.test(po) && po.length <= 80) return po;
  return `LEGACY-${activityCode}`.toUpperCase().slice(0, 80);
}

// Attach one legacy Activity to an ACTIVE contract. Adds contract lines for
// the Activity's legacy task codes (without budget), keeps any extra lines
// listed in `alsoLineCodes`, and makes members of the given people plus
// everyone who has already logged time on the Activity (at `defaultRoleId`).
export async function attachLegacyActivity(
  tx: Prisma.TransactionClient,
  activityId: number,
  contractId: number,
  opts: { members?: Member[]; defaultRoleId: number; alsoLineCodes?: string[] }
): Promise<ScopeResult> {
  const activity = await tx.activity.findUniqueOrThrow({ where: { id: activityId }, include: { tasks: true } });
  const contract = await tx.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { tasks: { include: { taskMaster: true } } },
  });

  const lineByCode = new Map(contract.tasks.map((t) => [t.taskMaster.code, t.id]));
  const wanted = new Set<number>();
  let sortOrder = contract.tasks.length;

  for (const t of activity.tasks.filter((x) => x.contractTaskId === null)) {
    const code = t.taskId.trim().toUpperCase().slice(0, 40);
    let lineId = lineByCode.get(code);
    if (lineId === undefined) {
      const master = await tx.master.upsert({
        where: { type_code: { type: MasterType.TASK, code } },
        update: {},
        create: { type: MasterType.TASK, code, description: t.taskName },
      });
      const line = await tx.contractTask.create({
        data: { contractId, taskMasterId: master.id, sortOrder: sortOrder++ },
      });
      lineId = line.id;
      lineByCode.set(code, lineId);
    }
    wanted.add(lineId);
  }
  for (const code of opts.alsoLineCodes ?? []) {
    const id = lineByCode.get(code);
    if (id !== undefined) wanted.add(id);
  }

  const members = new Map<number, number>((opts.members ?? []).map((m) => [m.userId, m.resourceTypeId]));
  const loggers = await tx.timesheet.groupBy({ by: ["userId"], where: { activityId } });
  for (const { userId } of loggers) if (!members.has(userId)) members.set(userId, opts.defaultRoleId);

  return applyActivityScope(tx, activityId, {
    contractId,
    contractTaskIds: [...wanted],
    members: [...members].map(([userId, resourceTypeId]) => ({ userId, resourceTypeId })),
  });
}

// Every remaining legacy Activity gets a contract: reuse an ACTIVE one for
// the same client whose code equals the Activity's PO reference, otherwise
// create one (ACTIVE, one zero rate at `roleCode`, no budget) for staff to
// complete later.
export async function backfillLegacyActivities(opts: {
  userId: number;
  currencyCode?: string;
  roleCode?: string;
  log?: (msg: string) => void;
}): Promise<number> {
  const log = opts.log ?? (() => {});
  const [currency, role] = await Promise.all([
    prisma.master.findUniqueOrThrow({
      where: { type_code: { type: MasterType.CURRENCY, code: opts.currencyCode ?? "GBP" } },
    }),
    prisma.master.findUniqueOrThrow({
      where: { type_code: { type: MasterType.RESOURCE_TYPE, code: opts.roleCode ?? "TC" } },
    }),
  ]);

  const legacy = await prisma.activity.findMany({
    where: { contractId: null },
    include: { tasks: true },
    orderBy: { id: "asc" },
  });

  let done = 0;
  for (const a of legacy) {
    if (a.tasks.length === 0) {
      log(`  ${a.activityId}: skipped (no tasks). Attach a contract from the Activities page.`);
      continue;
    }
    const poRef = a.tasks.find((t) => t.poRef?.trim())?.poRef ?? null;
    let code = legacyContractCode(poRef, a.activityId);
    const found = await prisma.contract.findUnique({ where: { code }, include: { rates: true } });
    if (found && (found.clientId !== a.clientId || found.status !== "ACTIVE")) {
      code = legacyContractCode(null, a.activityId);
    }

    await prisma.$transaction(
      async (tx) => {
        let contract = await tx.contract.findUnique({ where: { code }, include: { rates: true } });
        if (!contract) {
          contract = await tx.contract.create({
            data: {
              code,
              description: `Created from V1 Activity ${a.activityId}. Review rates and budgets.`,
              clientId: a.clientId,
              currencyId: currency.id,
              status: "ACTIVE",
              activatedAt: new Date(),
              createdById: opts.userId,
              rates: { create: [{ resourceTypeId: role.id, ratePerHour: new Prisma.Decimal(0) }] },
            },
            include: { rates: true },
          });
        }
        const defaultRoleId = contract.rates.some((r) => r.resourceTypeId === role.id)
          ? role.id
          : contract.rates[0]?.resourceTypeId;
        if (defaultRoleId === undefined) throw new Error(`Contract ${code} has no role rates`);
        const res = await attachLegacyActivity(tx, a.id, contract.id, { defaultRoleId });
        await tx.auditLog.create({
          data: {
            userId: opts.userId,
            action: "contract.backfill",
            entity: "Activity",
            entityId: String(a.id),
            meta: { activityId: a.activityId, contract: code, ...res } as Prisma.InputJsonValue,
          },
        });
        log(`  ${a.activityId} -> ${code} (tasks linked: ${res.mappedLegacy.join(", ") || "none"}; members: ${res.members})`);
      },
      { timeout: 30_000 }
    );
    done++;
  }
  return done;
}
