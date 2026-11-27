import type { Prisma } from "@prisma/client";
import { dayCapError } from "@/lib/entry-date";

// Server side of the per-day hours cap (MAX_DAY_HOURS). Call inside the same
// transaction that writes the entry: the user row lock serialises concurrent
// saves by one user, so two requests can't both pass the check and together
// exceed the cap. `excludeId` = the entry being edited (its old hours don't count).
export async function checkDayCap(
  tx: Prisma.TransactionClient,
  userId: number,
  date: Date,
  hours: number,
  excludeId?: number
): Promise<string | null> {
  await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
  const agg = await tx.timesheet.aggregate({
    where: { userId, date, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _sum: { hours: true },
  });
  return dayCapError(Number(agg._sum.hours ?? 0), hours);
}
