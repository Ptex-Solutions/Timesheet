import { Prisma, MasterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActivityId } from "@/lib/activity-code";

// Allocates the next global activity sequence number atomically.
// Must run inside a transaction the caller provides. The row-level
// `FOR UPDATE` lock serialises concurrent activity creations under MySQL
// REPEATABLE READ (same pattern as app/api/users/route.ts's
// last-Super-Admin guard) — without it two concurrent transactions could
// each read the same `current` value and allocate the same seq.
export async function allocateNextSeq(tx: Prisma.TransactionClient): Promise<number> {
  await tx.$queryRaw`SELECT current FROM ActivitySequence WHERE id = 1 FOR UPDATE`;
  await tx.$executeRaw`UPDATE ActivitySequence SET current = current + 1 WHERE id = 1`;
  const row = await tx.activitySequence.findUniqueOrThrow({ where: { id: 1 } });
  return row.current;
}

export interface CreateActivityInput {
  name: string;
  clientId: number;
  typeId: number;
  productId: number;
  versionId: number;
  moduleId: number;
  cloudOnPremId?: number | null;
}

async function loadMaster(
  tx: Prisma.TransactionClient,
  id: number,
  expectedType: MasterType,
  label: string
) {
  const master = await tx.master.findUnique({ where: { id } });
  if (!master) throw new Error(`${label} master not found (id ${id})`);
  if (master.type !== expectedType) {
    throw new Error(`${label} master (id ${id}) is not type ${expectedType}`);
  }
  if (!master.isActive) throw new Error(`${label} master (id ${id}) is not active`);
  return master;
}

async function createActivityInTx(input: CreateActivityInput, tx: Prisma.TransactionClient) {
  const [client, type, product, version, module_] = await Promise.all([
    loadMaster(tx, input.clientId, MasterType.CLIENT, "Client"),
    loadMaster(tx, input.typeId, MasterType.TYPE, "Type"),
    loadMaster(tx, input.productId, MasterType.PRODUCT, "Product"),
    loadMaster(tx, input.versionId, MasterType.VERSION, "Version"),
    loadMaster(tx, input.moduleId, MasterType.MODULE, "Module"),
  ]);

  let cloudOnPrem = null;
  if (input.cloudOnPremId != null) {
    cloudOnPrem = await loadMaster(
      tx,
      input.cloudOnPremId,
      MasterType.CLOUD_ON_PREM,
      "Cloud/On-Prem"
    );
  }

  const seq = await allocateNextSeq(tx);
  const activityId = buildActivityId({
    clientCode: client.code,
    moduleCode: module_.code,
    typeCode: type.code,
    versionCode: version.code,
    seq,
  });

  return tx.activity.create({
    data: {
      activityId,
      seq,
      name: input.name,
      clientId: client.id,
      typeId: type.id,
      productId: product.id,
      versionId: version.id,
      moduleId: module_.id,
      cloudOnPremId: cloudOnPrem?.id ?? null,
    },
  });
}

// Creates an Activity: allocates the next global seq and builds its
// activityId from the chosen Masters' codes. If no `tx` is given, opens its
// own transaction; otherwise runs inside the caller's transaction (e.g. to
// batch several activities + their tasks atomically, as the seed does).
export async function createActivity(input: CreateActivityInput, tx?: Prisma.TransactionClient) {
  if (tx) return createActivityInTx(input, tx);
  return prisma.$transaction((innerTx) => createActivityInTx(input, innerTx));
}
