import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import { contractDetailInclude, contractTotals } from "@/lib/contract-service";
import { formatMoney } from "@/lib/contract-calc";
import { Topbar } from "@/components/shared/app-topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CONTRACT_TYPE_LABEL, ContractStatusBadge } from "./editor";

export default async function ContractsPage() {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("contracts.view")) redirect("/admin/dashboard");

  const contracts = await prisma.contract.findMany({
    orderBy: [{ status: "asc" }, { code: "asc" }],
    include: contractDetailInclude,
  });

  return (
    <>
      <Topbar title="Contracts" subtitle="Statements of Work: rates, scope and budget" />
      <div className="p-6">
        <PageHeader
          title="Contracts (SOW)"
          description="Each contract defines agreed role rates, the tasks in scope and budgeted hours. Activities pick their tasks from an active contract."
          actions={
            access.perms.has("contracts.edit") ? (
              <Button asChild>
                <Link href="/admin/contracts/new">
                  <Plus className="h-4 w-4" /> New Contract
                </Link>
              </Button>
            ) : undefined
          }
        />
        <Card>
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500 text-sm">
              <FileSignature className="h-6 w-6 text-slate-300" />
              No contracts yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => {
                  const t = contractTotals(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-medium text-navy">{c.code}</TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[280px] truncate">{c.description || "—"}</TableCell>
                      <TableCell className="text-sm">{CONTRACT_TYPE_LABEL[c.type]}</TableCell>
                      <TableCell className="font-mono text-xs">{c.client.code}</TableCell>
                      <TableCell className="font-mono text-xs">{c.currency.code}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.totalHours}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatMoney(t.totalAmount, c.currency.code)}</TableCell>
                      <TableCell>
                        <ContractStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/contracts/${c.id}`}>
                            {access.perms.has("contracts.edit") && c.status !== "CLOSED" ? "Edit" : "View"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
