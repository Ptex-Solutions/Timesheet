import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import { activityAdminInclude } from "@/lib/activity-service";
import { ACTIVITY_MASTER_TYPES } from "@/lib/master-types";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { ActivitiesPanel, type MasterOption, type MastersByType } from "./manager";

export default async function ActivitiesPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("activities.view")) redirect("/admin/dashboard");

  const [masterRows, activities, contracts, users] = await Promise.all([
    prisma.master.findMany({
      // Only the categories an Activity is built from; contract-only masters
      // (Currency, Resource Type, Tasks) have no slot in MastersByType.
      where: { type: { in: [...ACTIVITY_MASTER_TYPES] } },
      orderBy: { code: "asc" },
      select: { id: true, type: true, code: true, description: true, isActive: true },
    }),
    prisma.activity.findMany({
      orderBy: { activityId: "asc" },
      include: activityAdminInclude,
    }),
    // For the Contract / SOW picker: tasks and roles, never rates.
    prisma.contract.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        description: true,
        clientId: true,
        status: true,
        tasks: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true, taskMaster: { select: { id: true, code: true, description: true } } },
        },
        rates: {
          orderBy: { id: "asc" },
          select: { resourceType: { select: { id: true, code: true, description: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true },
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
  for (const { type, ...m } of masterRows) masters[type as keyof MastersByType].push(m as MasterOption);

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
            contract: a.contract,
            members: a.members,
            tasks: a.tasks.map((t) => ({
              contractTaskId: t.contractTaskId,
              id: t.id,
              taskId: t.taskId,
              taskName: t.taskName,
              poRef: t.poRef,
              isActive: t.isActive,
            })),
          }))}
          masters={masters}
          contracts={contracts.map(({ rates, ...c }) => ({ ...c, roles: rates.map((r) => r.resourceType) }))}
          users={users}
          canEdit={access.perms.has("activities.edit")}
          canDelete={access.perms.has("activities.delete")}
        />
      </div>
    </>
  );
}
