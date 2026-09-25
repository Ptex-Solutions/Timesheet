import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type Permission, type Role } from "@/lib/permissions";
import { getCurrentAccess } from "@/lib/authz";

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

export async function requirePermission(
  perm: Permission
): Promise<{ user: SessionUser; perms: Set<Permission> } | NextResponse> {
  const access = await getCurrentAccess();
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.perms.has(perm)) {
    return NextResponse.json({ error: `Forbidden: missing ${perm}` }, { status: 403 });
  }
  return access;
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

// Parses a JSON request body; malformed JSON becomes a 400 instead of a 500.
export async function readJsonBody(req: Request): Promise<{ body: any } | NextResponse> {
  try {
    return { body: await req.json() };
  } catch {
    return badRequest("Invalid JSON");
  }
}

// Positive-integer id from a body field or query param; null if invalid.
export function parseId(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
