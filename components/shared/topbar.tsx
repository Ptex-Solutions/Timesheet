"use client";

import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Search, ChevronDown, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { isStaffRole, ROLE_LABELS, type Role } from "@/lib/permissions";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data } = useSession();
  const user = data?.user;
  const role = (user as any)?.role as Role | undefined;
  const roleLabel = role && role in ROLE_LABELS ? ROLE_LABELS[role] : (role ?? "");
  const initials =
    (user?.name ?? "")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-slate-200 bg-white/70 backdrop-blur-md sticky top-0 z-30">
      <div>
        <h1 className="font-display text-lg font-semibold text-navy leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 -mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs">
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-2 hidden lg:inline text-[10px] px-1.5 py-0.5 rounded border border-slate-300 bg-white">⌘K</kbd>
        </div>
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-slate-100 transition">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left leading-tight">
              <p className="text-xs font-semibold text-navy">{user?.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                {roleLabel}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={isStaffRole(role) ? "/admin/settings" : "/employee/profile"}>
                <UserCircle className="h-4 w-4" /> Profile
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-700"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
