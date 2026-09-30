import { prisma } from "@/lib/prisma";

// Resolves the Activity/Task pair a timesheet (or sandbox entry) points at and
// derives the fields the server owns: clientId (from the Activity; the
// client's own clientId is never trusted, Client is only a UI filter) and
// type (the Activity's TYPE master code).
//
// Guarantees task.activityId === activity.id, so a stale form (task moved to
// another activity) or a crafted request with a mismatched pair is rejected
// with a 400 instead of persisting an inconsistent row.
//
// Season 2, for Activities that execute a Contract:
// - the task must deliver a SOW line of *that* contract (never a line of an
//   unrelated contract), and the contract must be ACTIVE;
// - with `memberUserId` (real timesheets, not sandbox what-ifs) the person
//   must be a member of the Activity; their billing role is returned as
//   `resourceTypeId` so the caller can snapshot it on the entry.
//
// `allowInactive` lets an edit keep an activity/task that was deactivated
// (or whose contract closed, or whose membership ended) after the entry was
// created, as long as that id is unchanged.

export type ResolvedRefs = {
  clientId: number;
  activityId: number;
  taskId: number;
  type: string;
  contractId: number | null;
  // The member's billing role; null for pre-contract Activities, sandbox
  // resolution, or an unchanged entry whose author is no longer a member.
  resourceTypeId: number | null;
};

export type RefsResult = { ok: true; refs: ResolvedRefs } | { ok: false; error: string };

export async function resolveTimesheetRefs(
  activityId: number,
  taskId: number,
  allowInactive: { activityId?: number; taskId?: number } = {},
  opts: { memberUserId?: number } = {}
): Promise<RefsResult> {
  const [activity, task] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        type: { select: { code: true } },
        contract: { select: { id: true, code: true, status: true } },
      },
    }),
    prisma.task.findUnique({ where: { id: taskId }, include: { contractTask: { select: { contractId: true } } } }),
  ]);

  if (!activity) return { ok: false, error: "Activity not found" };
  const keepActivity = allowInactive.activityId === activity.id;
  const keepTask = allowInactive.taskId === taskId;
  if (!activity.isActive && !keepActivity) {
    return { ok: false, error: "Activity is not active" };
  }
  if (!task) return { ok: false, error: "Task not found" };
  if (task.activityId !== activity.id) {
    return { ok: false, error: "Task does not belong to the selected Activity" };
  }
  if (!task.isActive && !keepTask) {
    return { ok: false, error: "Task is not active" };
  }

  let resourceTypeId: number | null = null;
  if (activity.contract) {
    const sameContract = task.contractTask?.contractId === activity.contract.id;
    if (!sameContract && !keepTask) {
      return { ok: false, error: `Task is not part of contract ${activity.contract.code}` };
    }
    if (activity.contract.status !== "ACTIVE" && !keepActivity) {
      return { ok: false, error: `Contract ${activity.contract.code} is not active` };
    }
    if (opts.memberUserId !== undefined) {
      const member = await prisma.activityMember.findUnique({
        where: { activityId_userId: { activityId: activity.id, userId: opts.memberUserId } },
      });
      if (!member && !keepActivity) {
        return { ok: false, error: "You are not a member of this Activity" };
      }
      resourceTypeId = member?.resourceTypeId ?? null;
    }
  }

  return {
    ok: true,
    refs: {
      clientId: activity.clientId,
      activityId: activity.id,
      taskId: task.id,
      type: activity.type.code,
      contractId: activity.contract?.id ?? null,
      resourceTypeId,
    },
  };
}
