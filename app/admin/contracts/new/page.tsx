import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { Topbar } from "@/components/shared/app-topbar";
import { PageHeader } from "@/components/shared/page-header";
import { ContractEditor } from "../editor";
import { loadContractMasters } from "../data";

export default async function NewContractPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("contracts.edit")) redirect("/admin/contracts");

  const masters = await loadContractMasters();
  const gbp = masters.CURRENCY.find((c) => c.code === "GBP" && c.isActive);

  return (
    <>
      <Topbar title="New Contract" subtitle="Statement of Work" />
      <div className="p-6">
        <PageHeader
          title="New Contract (SOW)"
          description="Set the agreed role rates, then budget hours per task. Save as a draft, or activate it so Activities can use it."
        />
        <ContractEditor
          initial={{
            status: "DRAFT",
            code: "",
            description: "",
            clientId: "",
            currencyId: gbp ? String(gbp.id) : "",
            rates: [],
            tasks: [],
          }}
          masters={masters}
          canEdit
          canDelete={access.perms.has("contracts.delete")}
        />
      </div>
    </>
  );
}
