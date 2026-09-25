import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import { activityListInclude } from "@/lib/activity-service";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { ActivitiesPanel, type MasterOption, type MastersByType } from "./manager";

export default async function ActivitiesPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("clients.view")) redirect("/manager/dashboard");

  const [masterRows, activities] = await Promise.all([
    prisma.master.findMany({
      orderBy: { code: "asc" },
      select: { id: true, type: true, code: true, description: true, isActive: true },
    }),
    prisma.activity.findMany({
      orderBy: { activityId: "asc" },
      include: activityListInclude,
    }),
  ]);

  const masters: MastersByType = {
    CLIENT: [],
    TYPE: [],
    PRODUCT: [],
    VERSION: [],
    MODULE: [],
    CLOUD_ON_PREM: [],
  };
  for (const { type, ...m } of masterRows) masters[type].push(m as MasterOption);

  return (
    <>
      <Topbar title="Activities" subtitle="Activities and their Beeline tasks" />
      <div className="p-6">
        <PageHeader
          title="Activities"
          description="Create Activities from Masters (Client, Type, Product, Version, Module) — the Activity ID is generated automatically — and manage the tasks employees log against."
        />
        <ActivitiesPanel
          activities={activities.map((a) => ({
            id: a.id,
            activityId: a.activityId,
            name: a.name,
            isActive: a.isActive,
            client: a.client,
            type: a.type,
            product: a.product,
            version: a.version,
            module: a.module,
            cloudOnPrem: a.cloudOnPrem,
            tasks: a.tasks.map((t) => ({
              id: t.id,
              taskId: t.taskId,
              taskName: t.taskName,
              poRef: t.poRef,
              isActive: t.isActive,
            })),
          }))}
          masters={masters}
          canEdit={access.perms.has("clients.edit")}
          canDelete={access.perms.has("clients.delete")}
        />
      </div>
    </>
  );
}
