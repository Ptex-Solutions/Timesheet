import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { ClientsManager } from "./manager";

export default async function ClientsPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("clients.view")) redirect("/manager/dashboard");

  const clients = await prisma.client.findMany({
    where: { isActive: true },
    orderBy: { clientCode: "asc" },
    include: {
      projects: {
        where: { isActive: true },
        include: { tasks: { where: { isActive: true } } },
      },
    },
  });

  return (
    <>
      <Topbar title="Clients & Projects" subtitle="Master data for timesheet entries" />
      <div className="p-6">
        <PageHeader
          title="Clients, Projects & Tasks"
          description="Define your clients, the activities (projects) under them, and the Beeline tasks that employees can log against."
        />
        <ClientsManager
          initial={clients as any}
          canEdit={access.perms.has("clients.edit")}
          canDelete={access.perms.has("clients.delete")}
        />
      </div>
    </>
  );
}
