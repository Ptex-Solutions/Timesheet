import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { STAFF_ROLES } from "@/lib/permissions";
import { timesheetCommentSchema } from "@/lib/validations";
import { loadQueryThread } from "@/lib/timesheet-query";

// Staff-only discussion thread. `timesheets.view` is never held by employees,
// so this is unreachable from the employee portal even though /api/timesheets
// itself is not staff-only in middleware.

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const access = await requirePermission("timesheets.view");
  if (access instanceof NextResponse) return access;
  const id = parseId(ctx.params.id);
  if (!id) return badRequest("Missing or invalid id");
  const exists = await prisma.timesheet.count({ where: { id, status: { not: "DRAFT" } } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: await loadQueryThread(id) });
}

// Posting a comment opens the query (or reopens a resolved one).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const access = await requirePermission("timesheets.view");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const id = parseId(ctx.params.id);
  if (!id) return badRequest("Missing or invalid id");

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = timesheetCommentSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { body } = parsed.data;
  const mentionIds = [...new Set(parsed.data.mentionIds)];

  const exists = await prisma.timesheet.count({ where: { id, status: { not: "DRAFT" } } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only active staff can be tagged.
  if (mentionIds.length) {
    const valid = await prisma.user.count({
      where: { id: { in: mentionIds }, isActive: true, role: { in: [...STAFF_ROLES] } },
    });
    if (valid !== mentionIds.length) return badRequest("You can only tag active staff members");
  }

  const reopened = await prisma.$transaction(async (tx) => {
    await tx.timesheetComment.create({
      data: {
        timesheetId: id,
        authorId: user.id,
        body,
        mentions: { create: mentionIds.map((userId) => ({ userId })) },
      },
    });
    const existing = await tx.timesheetQuery.findUnique({ where: { timesheetId: id } });
    if (!existing) {
      await tx.timesheetQuery.create({ data: { timesheetId: id, openedById: user.id } });
      return false;
    }
    if (existing.status === "RESOLVED") {
      await tx.timesheetQuery.update({
        where: { timesheetId: id },
        data: { status: "OPEN", openedById: user.id, openedAt: new Date(), resolvedById: null, resolvedAt: null },
      });
      return true;
    }
    return false;
  });

  await audit({
    userId: user.id,
    action: "comment",
    entity: "Timesheet",
    entityId: id,
    meta: { mentions: mentionIds, reopened },
  });

  return NextResponse.json({ data: await loadQueryThread(id) }, { status: 201 });
}
