// Staff-only query/comment thread on a timesheet entry. Server-only (prisma).
// Callers must already have checked `timesheets.view` — employees never hold
// it, so this data is never reachable from the employee portal.
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/permissions";

export type StaffUser = { id: number; name: string; employeeCode: string; role: string };

export type QueryComment = {
  id: number;
  body: string;
  createdAt: string;
  author: { id: number; name: string };
  mentions: Array<{ id: number; name: string }>;
};

export type QueryThread = {
  status: "OPEN" | "RESOLVED" | null; // null = no query raised yet
  openedAt: string | null;
  openedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  comments: QueryComment[];
};

// Everyone who can be @-mentioned: active staff.
export async function listMentionableStaff(): Promise<StaffUser[]> {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: [...STAFF_ROLES] } },
    select: { id: true, name: true, employeeCode: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function loadQueryThread(timesheetId: number): Promise<QueryThread> {
  const [query, comments] = await Promise.all([
    prisma.timesheetQuery.findUnique({
      where: { timesheetId },
      include: {
        openedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } },
      },
    }),
    prisma.timesheetComment.findMany({
      where: { timesheetId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true } },
        mentions: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
  ]);

  return {
    status: query?.status ?? null,
    openedAt: query?.openedAt.toISOString() ?? null,
    openedBy: query?.openedBy.name ?? null,
    resolvedAt: query?.resolvedAt?.toISOString() ?? null,
    resolvedBy: query?.resolvedBy?.name ?? null,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
      mentions: c.mentions.map((m) => m.user),
    })),
  };
}
