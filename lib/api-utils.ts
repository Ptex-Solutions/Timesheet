import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";

export type SessionUser = {
  id: number;
  role: Role;
  employeeCode: string;
  name?: string | null;
  email?: string | null;
};

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user as SessionUser;
}

export async function requireManager(): Promise<SessionUser | NextResponse> {
  const u = await requireUser();
  if (u instanceof NextResponse) return u;
  if (u.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return u;
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export async function audit(opts: {
  userId: number;
  action: string;
  entity: string;
  entityId?: string | number | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId == null ? null : String(opts.entityId),
        meta: opts.meta as any,
        ip: opts.ip ?? undefined,
      },
    });
  } catch (e) {
    // never let audit failures break a request
    console.error("audit failed", e);
  }
}
