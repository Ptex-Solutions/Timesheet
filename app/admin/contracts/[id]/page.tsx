import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import { contractDetailInclude } from "@/lib/contract-service";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { ContractEditor } from "../editor";
import { loadContractMasters, toFormValue } from "../data";

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("contracts.view")) redirect("/admin/dashboard");

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [contract, masters] = await Promise.all([
    prisma.contract.findUnique({ where: { id }, include: contractDetailInclude }),
    loadContractMasters(),
  ]);
  if (!contract) notFound();

  return (
    <>
      <Topbar title={contract.code} subtitle="Statement of Work" />
      <div className="p-6">
        <PageHeader
          title={contract.code}
          description={`${contract.client.code} · ${contract.currency.code} · created by ${contract.createdBy.name}`}
        />
        <ContractEditor
          // Remount on refresh so saved server state replaces local edits.
          key={contract.updatedAt.toISOString()}
          initial={toFormValue(contract)}
          masters={masters}
          canEdit={access.perms.has("contracts.edit")}
          canDelete={access.perms.has("contracts.delete")}
        />
      </div>
    </>
  );
}
