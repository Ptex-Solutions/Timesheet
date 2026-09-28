import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, readJsonBody } from "@/lib/api-utils";
import { getCurrentAccess } from "@/lib/authz";
import { timesheetUpdateSchema } from "@/lib/validations";
import { resolveTimesheetRefs } from "@/lib/timesheet-refs";
import { dayCount, isoYearWeek, weekLabelForDate, weekdayKey } from "@/lib/utils";

const FIELD_KEYS = ["date", "clientId", "activityId", "taskId", "description", "hours"] as const;

async function loadTimesheet(id: number) {
  const access = await getCurrentAccess();
  if (!access) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const ts = Number.isFinite(id) ? await prisma.timesheet.findUnique({ where: { id } }) : null;
  if (!ts) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const isOwner = ts.userId === access.user.id;
  // Another user's DRAFT is private to them: invisible to staff for every
  // operation (read, edit, delete), not just forbidden.
  if (!isOwner && ts.status === "DRAFT") {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { ...access, ts, isOwner };
}

function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = parseInt(ctx.params.id, 10);
  const a = await loadTimesheet(id);
  if ("error" in a) return a.error;
  if (!a.isOwner && !a.perms.has("timesheets.view")) return forbidden();

  const data = await prisma.timesheet.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, employeeCode: true } },
      client: true,
      activity: { include: { client: true, type: true } },
      task: true,
    },
  });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  const id = parseInt(ctx.params.id, 10);
  const a = await loadTimesheet(id);
  if ("error" in a) return a.error;
  const { user, perms, ts, isOwner } = a;

  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = timesheetUpdateSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;
  const hasFieldEdits = FIELD_KEYS.some((k) => v[k] !== undefined);

  // --- Re-open: APPROVED -> DRAFT ------------------------------------------
  if (ts.status === "APPROVED" && v.status && v.status !== "APPROVED") {
    if (!perms.has("timesheets.reopen")) return forbidden("Forbidden: missing timesheets.reopen");
    if (hasFieldEdits) {
      return NextResponse.json({ error: "Re-open the timesheet before editing" }, { status: 400 });
    }
    const data = { status: "DRAFT" as const, approvedAt: null, submittedAt: null, rejectionNote: null };
    const updated = await prisma.timesheet.update({ where: { id }, data });
    await audit({ userId: user.id, action: "reopen", entity: "Timesheet", entityId: id, meta: { changes: Object.keys(data) } });
    return NextResponse.json({ data: updated });
  }

  const isDecision = v.status === "APPROVED" || v.status === "REJECTED";

  if (isDecision) {
    // --- Approve / reject ---------------------------------------------------
    if (!perms.has("timesheets.approve")) return forbidden("Forbidden: missing timesheets.approve");
    if (ts.status !== "SUBMITTED") {
      return NextResponse.json({ error: "Only SUBMITTED timesheets can be approved or rejected" }, { status: 400 });
    }
    if (hasFieldEdits && !perms.has("timesheets.edit")) return forbidden("Forbidden: missing timesheets.edit");
  } else {
    // --- Field edits and/or DRAFT/SUBMITTED status --------------------------
    if (ts.status === "APPROVED") {
      return NextResponse.json({ error: "Re-open the timesheet before editing" }, { status: 400 });
    }
    // Owners may fix their own DRAFT entries, and REJECTED ones so they can
    // correct and resubmit them. Status here can only be DRAFT or SUBMITTED
    // (APPROVED/REJECTED take the decision branch above).
    const ownerEditable = isOwner && (ts.status === "DRAFT" || ts.status === "REJECTED");
    if (!ownerEditable && !perms.has("timesheets.edit")) {
      return forbidden(isOwner ? "Only DRAFT or REJECTED timesheets can be edited" : "Forbidden");
    }
  }

  const data: any = {};
  if (v.date) {
    const date = new Date(v.date);
    data.date = date;
    const wk = isoYearWeek(date);
    data.weekNo = wk.week;
    data.weekLabel = weekLabelForDate(date);
    const key = weekdayKey(date);
    data.sat = 0; data.sun = 0; data.mon = 0; data.tue = 0; data.wed = 0; data.thu = 0; data.fri = 0;
    (data as any)[key] = v.hours ?? Number(ts.hours);
  }
  if (v.clientId !== undefined || v.activityId !== undefined || v.taskId !== undefined) {
    // Re-validate the (possibly partial) Activity/Task pair against the stored
    // row: the task must belong to the activity, and clientId/type are derived
    // from the activity (a submitted clientId is ignored). Unchanged ids may
    // point at since-deactivated rows; newly chosen ones must be active.
    const resolved = await resolveTimesheetRefs(v.activityId ?? ts.activityId, v.taskId ?? ts.taskId, {
      activityId: ts.activityId,
      taskId: ts.taskId,
    });
    if (!resolved.ok) return badRequest(resolved.error);
    data.clientId = resolved.refs.clientId;
    data.activityId = resolved.refs.activityId;
    data.taskId = resolved.refs.taskId;
    data.type = resolved.refs.type;
  }
  if (v.description !== undefined) data.description = v.description;
  if (v.hours !== undefined) {
    data.hours = v.hours;
    data.minutes = Math.round(v.hours * 60);
    if (data.date == null) {
      const key = weekdayKey(ts.date);
      (data as any)[key] = v.hours;
    }
  }

  if (v.status) {
    data.status = v.status;
    if (v.status === "SUBMITTED") data.submittedAt = new Date();
    if (v.status === "APPROVED") {
      data.approvedAt = new Date();
      data.rejectionNote = null;
    }
    if (v.status === "REJECTED") data.rejectionNote = v.rejectionNote ?? null;
  }

  const action =
    v.status === "APPROVED"
      ? "approve"
      : v.status === "REJECTED"
        ? "reject"
        : v.status === "SUBMITTED" && ts.status === "REJECTED"
          ? "resubmit"
          : "update";
  const updated = await prisma.timesheet.update({ where: { id }, data });
  await audit({ userId: user.id, action, entity: "Timesheet", entityId: id, meta: { changes: Object.keys(data) } });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = parseInt(ctx.params.id, 10);
  const a = await loadTimesheet(id);
  if ("error" in a) return a.error;
  const { user, perms, ts, isOwner } = a;

  if (!(isOwner && ts.status === "DRAFT") && !perms.has("timesheets.delete")) {
    return forbidden(isOwner ? "Only DRAFT timesheets can be deleted" : "Forbidden");
  }

  await prisma.timesheet.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", entity: "Timesheet", entityId: id });
  return NextResponse.json({ ok: true });
}
