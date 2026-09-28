import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, readJsonBody, requirePermission } from "@/lib/api-utils";
import { timesheetBulkDecisionSchema } from "@/lib/validations";

// Approve or reject several entries from the All Timesheets table. Same rule
// as the single-entry PUT: only SUBMITTED entries can be decided; others are
// skipped and reported back.
export async function POST(req: NextRequest) {
  const access = await requirePermission("timesheets.approve");
  if (access instanceof NextResponse) return access;
  const { user } = access;

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = timesheetBulkDecisionSchema.safeParse(json.body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.rejectionNote?.[0] ?? "Invalid input";
    return NextResponse.json({ error: msg, details: parsed.error.flatten() }, { status: 400 });
  }
  const { status, rejectionNote } = parsed.data;
  const ids = [...new Set(parsed.data.ids)];

  const eligible = await prisma.timesheet.findMany({
    where: { id: { in: ids }, status: "SUBMITTED" },
    select: { id: true },
  });
  const eligibleIds = eligible.map((e) => e.id);

  if (eligibleIds.length) {
    await prisma.timesheet.updateMany({
      where: { id: { in: eligibleIds }, status: "SUBMITTED" },
      data:
        status === "APPROVED"
          ? { status, approvedAt: new Date(), rejectionNote: null }
          : { status, rejectionNote: rejectionNote ?? null },
    });
    for (const id of eligibleIds) {
      await audit({
        userId: user.id,
        action: status === "APPROVED" ? "approve" : "reject",
        entity: "Timesheet",
        entityId: id,
        meta: { bulk: true },
      });
    }
  }

  return NextResponse.json({
    data: { updated: eligibleIds.length, skipped: ids.length - eligibleIds.length },
  });
}
