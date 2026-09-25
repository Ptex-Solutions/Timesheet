import { prisma } from "@/lib/prisma";

// Resolves the Activity/Task pair a timesheet (or sandbox entry) points at and
// derives the fields the server owns: clientId (from the Activity — the
// client's own clientId is never trusted, Client is only a UI filter) and
// type (the Activity's TYPE master code).
//
// Guarantees task.activityId === activity.id, so a stale form (task moved to
// another activity) or a crafted request with a mismatched pair is rejected
// with a 400 instead of persisting an inconsistent row.
//
// `allowInactive` lets an edit keep an activity/task that was deactivated
// after the entry was created, as long as that id is unchanged.

export type ResolvedRefs = {
  clientId: number;
  activityId: number;
  taskId: number;
  type: string;
};

export type RefsResult = { ok: true; refs: ResolvedRefs } | { ok: false; error: string };

export async function resolveTimesheetRefs(
  activityId: number,
  taskId: number,
  allowInactive: { activityId?: number; taskId?: number } = {}
): Promise<RefsResult> {
  const [activity, task] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: activityId },
      include: { type: { select: { code: true } } },
    }),
    prisma.task.findUnique({ where: { id: taskId } }),
  ]);

  if (!activity) return { ok: false, error: "Activity not found" };
  if (!activity.isActive && allowInactive.activityId !== activity.id) {
    return { ok: false, error: "Activity is not active" };
  }
  if (!task) return { ok: false, error: "Task not found" };
  if (task.activityId !== activity.id) {
    return { ok: false, error: "Task does not belong to the selected Activity" };
  }
  if (!task.isActive && allowInactive.taskId !== task.id) {
    return { ok: false, error: "Task is not active" };
  }

  return {
    ok: true,
    refs: {
      clientId: activity.clientId,
      activityId: activity.id,
      taskId: task.id,
      type: activity.type.code,
    },
  };
}
