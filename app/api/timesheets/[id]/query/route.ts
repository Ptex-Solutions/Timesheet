import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { timesheetQueryStatusSchema } from "@/lib/validations";
import { loadQueryThread } from "@/lib/timesheet-query";

// Mark a staff query resolved (or reopen it). Staff-only via timesheets.view.
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const access = await requirePermission("timesheets.view");
  if (access instanceof NextResponse) return access;
  const { user } = access;
  const id = parseId(ctx.params.id);
  if (!id) return badRequest("Missing or invalid id");

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = timesheetQueryStatusSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
  const { status } = parsed.data;

  const existing = await prisma.timesheetQuery.findUnique({ where: { timesheetId: id } });
  if (!existing) return NextResponse.json({ error: "No query has been raised on this entry" }, { status: 404 });
  if (existing.status === status) {
    return badRequest(status === "RESOLVED" ? "Query is already resolved" : "Query is already open");
  }

  await prisma.timesheetQuery.update({
    where: { timesheetId: id },
    data:
      status === "RESOLVED"
        ? { status, resolvedById: user.id, resolvedAt: new Date() }
        : { status, openedById: user.id, openedAt: new Date(), resolvedById: null, resolvedAt: null },
  });
  await audit({
    userId: user.id,
    action: status === "RESOLVED" ? "query.resolve" : "query.reopen",
    entity: "Timesheet",
    entityId: id,
  });

  return NextResponse.json({ data: await loadQueryThread(id) });
}
