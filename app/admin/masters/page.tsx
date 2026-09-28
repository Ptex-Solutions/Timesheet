import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { MastersPanel } from "./panel";

export default async function MastersPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("clients.view")) redirect("/admin/dashboard");

  return (
    <>
      <Topbar title="Masters" subtitle="Code lists for Activities" />
      <div className="p-6">
        <PageHeader
          title="Masters"
          description="Manage the code lists used to build Activities: Type, Client, Product, Version, Module, Cloud / On Prem."
        />
        <MastersPanel
          canEdit={access.perms.has("clients.edit")}
          canDelete={access.perms.has("clients.delete")}
        />
      </div>
    </>
  );
}
