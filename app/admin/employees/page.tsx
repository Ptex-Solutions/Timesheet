import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import type { Role } from "@/lib/permissions";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeesManager } from "./manager";

export default async function EmployeesPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("employees.view")) redirect("/admin/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, role: true, employeeCode: true, isActive: true, createdAt: true,
    },
  });

  return (
    <>
      <Topbar title="Employees" subtitle="Manage your team" />
      <div className="p-6">
        <PageHeader
          title="Employees"
          description="Add, edit, deactivate users and assign roles."
        />
        <EmployeesManager
          initial={users.map((u) => ({ ...u, role: u.role as Role, createdAt: u.createdAt.toISOString() }))}
          actorId={access.user.id}
          actorRole={access.user.role}
          canEdit={access.perms.has("employees.edit")}
          canDelete={access.perms.has("employees.delete")}
        />
      </div>
    </>
  );
}
