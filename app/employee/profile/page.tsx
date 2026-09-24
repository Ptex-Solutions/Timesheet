import { Mail, ShieldCheck, IdCard, Calendar } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/shared/topbar";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export default async function ProfilePage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { id: session!.user.id } });
  if (!me) return null;

  const initials = me.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <>
      <Topbar title="My Profile" />
      <div className="p-6">
        <PageHeader title="Profile" description="Your account details" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col items-center text-center pt-8 pb-8">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <h3 className="font-display font-bold text-xl text-navy mt-4">{me.name}</h3>
              <RoleBadge role={me.role as Role} className="mt-2" />
              <p className="text-sm text-slate-500 mt-3">Employee Code · <span className="font-mono font-semibold text-slate-700">{me.employeeCode}</span></p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field icon={Mail} label="Email" value={me.email} />
              <Field icon={IdCard} label="Employee Code" value={me.employeeCode} mono />
              <Field icon={ShieldCheck} label="Role" value={ROLE_LABELS[me.role as Role]} />
              <Field icon={Calendar} label="Joined" value={formatDate(me.createdAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50/50 border border-slate-100">
      <div className="h-10 w-10 rounded-lg bg-brand-gradient flex items-center justify-center text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`font-medium text-navy ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
