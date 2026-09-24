import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-utils";
import { loadAccessUsers } from "@/lib/access-data";
import { MODULES } from "@/lib/permissions";

export async function GET() {
  const access = await requirePermission("access.view");
  if (access instanceof NextResponse) return access;
  const users = await loadAccessUsers({ role: access.user.role, perms: access.perms });
  return NextResponse.json({ data: { users, modules: MODULES } });
}
