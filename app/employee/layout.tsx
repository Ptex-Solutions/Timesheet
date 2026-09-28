"use client";
export const dynamic = "force-dynamic";
import { Sidebar, type NavItem } from "@/components/shared/sidebar";
import { LayoutDashboard, FileSpreadsheet, UserCircle } from "lucide-react";

const items: NavItem[] = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/timesheet", label: "My Timesheets", icon: FileSpreadsheet },
  { href: "/employee/profile", label: "Profile", icon: UserCircle },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar items={items} portalLabel="Employee" portalAccent="bg-emerald-500/10 text-emerald-300" />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
