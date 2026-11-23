// One-off, idempotent: gives every pre-contract (V1) Activity a Contract so
// the Season 2 rules (SOW tasks, members-only logging) apply everywhere.
//   npx tsx scripts/backfill-contracts.ts [--currency GBP] [--role TC]
import { prisma } from "@/lib/prisma";
import { backfillLegacyActivities } from "@/lib/contract-backfill";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const actor = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true }, orderBy: { id: "asc" } });
  if (!actor) throw new Error("No active Super Admin to attribute the backfill to");
  console.log("Backfilling contracts for legacy Activities...");
  const n = await backfillLegacyActivities({
    userId: actor.id,
    currencyCode: arg("currency"),
    roleCode: arg("role"),
    log: console.log,
  });
  console.log(n === 0 ? "Nothing to do." : `Done: ${n} Activity(ies) attached.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
