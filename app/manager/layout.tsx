import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { isStaffRole } from "@/lib/permissions";
import { ManagerShell } from "@/components/shared/manager-shell";

// Permissions are resolved fresh from the DB on every request.
export const dynamic = "force-dynamic";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAccess();
  if (!access) redirect("/login");
  if (!isStaffRole(access.user.role)) redirect("/employee/dashboard");

  return (
    <ManagerShell perms={Array.from(access.perms)} role={access.user.role}>
      {children}
    </ManagerShell>
  );
}
