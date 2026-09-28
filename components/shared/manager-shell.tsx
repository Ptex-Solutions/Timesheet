"use client";

import { Sidebar, type NavItem } from "@/components/shared/sidebar";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Beaker,
  BarChart3,
  Users,
  Building2,
  Layers,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { type Permission, type Role } from "@/lib/permissions";

// Lucide icons are components and can't cross the server -> client boundary,
// so the nav list lives here and is filtered by the perms passed from the
// server layout. `perm: null` means always visible.
const ITEMS: (NavItem & { perm: Permission | null })[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
  { href: "/admin/timesheets", label: "All Timesheets", icon: FileSpreadsheet, perm: "timesheets.view" },
  { href: "/admin/sandbox", label: "Sandbox MIS", icon: Beaker, perm: "sandbox.view" },
  { href: "/admin/mis", label: "MIS Reports", icon: BarChart3, perm: "mis.view" },
  { href: "/admin/employees", label: "Employees", icon: Users, perm: "employees.view" },
  { href: "/admin/masters", label: "Masters", icon: Building2, perm: "clients.view" },
  { href: "/admin/activities", label: "Activities", icon: Layers, perm: "clients.view" },
  { href: "/admin/access", label: "Access Panel", icon: ShieldCheck, perm: "access.view" },
  { href: "/admin/settings", label: "Settings", icon: Settings, perm: null },
];

export function ManagerShell({
  perms,
  role,
  children,
}: {
  perms: string[];
  role: Role;
  children: React.ReactNode;
}) {
  const items: NavItem[] = ITEMS.filter((i) => i.perm === null || perms.includes(i.perm)).map(
    ({ perm: _perm, ...item }) => item
  );

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar items={items} portalLabel="Admin" portalAccent="bg-brand/15 text-brand-300" />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
