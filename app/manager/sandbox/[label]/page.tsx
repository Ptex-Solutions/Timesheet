import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SandboxEditor } from "./editor";

export default async function SandboxLabelPage({ params }: { params: { label: string } }) {
  const access = await getCurrentAccess();
  if (!access || !access.perms.has("sandbox.view")) redirect("/manager/dashboard");
  const label = decodeURIComponent(params.label);

  const [users, clients] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({
      where: { isActive: true },
      orderBy: { clientCode: "asc" },
      include: {
        projects: {
          where: { isActive: true },
          include: { tasks: { where: { isActive: true } } },
        },
      },
    }),
  ]);

  return (
    <>
      <Topbar title={`Sandbox: ${label}`} subtitle="Manager-only editing space" />
      <div className="p-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/sandbox"><ArrowLeft className="h-4 w-4" /> Back to sandboxes</Link>
          </Button>
        </div>
        <PageHeader
          title={label}
          description="Edit hours, reassign rows, add new entries, soft-delete unwanted ones, then finalize as MIS."
        />
        <SandboxEditor
          label={label}
          users={users as any}
          clients={clients as any}
          canEdit={access.perms.has("sandbox.edit")}
          canDelete={access.perms.has("sandbox.delete")}
          canFinalize={access.perms.has("mis.finalize")}
        />
      </div>
    </>
  );
}
