import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { loadAccessUsers } from "@/lib/access-data";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { AccessPanel } from "./panel";

export default async function AccessPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("access.view")) redirect("/manager/dashboard");

  const users = await loadAccessUsers({ role: access.user.role, perms: access.perms });

  return (
    <>
      <Topbar title="Access Panel" subtitle="Roles & permissions" />
      <div className="p-6">
        <PageHeader
          title="Access Panel"
          description="Assign module permissions to managers and admins."
        />
        <AccessPanel
          users={users}
          canEdit={access.perms.has("access.edit")}
          actorPerms={Array.from(access.perms)}
        />
      </div>
    </>
  );
}
