"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
] as const;
const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
const ALL = "__all";

// URL of the current page with `patch` applied (null/"" removes a param).
// Any filter change goes back to page 1.
function useHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("add");
    if (!("page" in patch)) next.delete("page");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

export function TimesheetFilters({
  view,
  rangeLabel,
  clients,
  total,
  totalHours,
}: {
  view: string;
  rangeLabel: string | null;
  clients: { id: number; code: string }[];
  total: number;
  totalHours: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const href = useHref();
  const [q, setQ] = useState(params.get("q") ?? "");
  const go = (patch: Record<string, string | null>) => router.push(href(patch), { scroll: false });
  const filtered = !!(params.get("status") || params.get("client") || params.get("q"));

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {/* View */}
      <div className="inline-flex rounded-lg bg-slate-100 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => go({ view: v.key })}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
              view === v.key ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {rangeLabel && <span className="text-xs text-slate-500 tabular-nums">{rangeLabel}</span>}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || null });
          }}
          className="relative"
        >
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => q.trim() !== (params.get("q") ?? "") && go({ q: q.trim() || null })}
            placeholder="Search task, activity, description"
            aria-label="Search"
            className="h-8 w-60 pl-8 text-xs"
          />
        </form>
        <Select value={params.get("status") ?? ALL} onValueChange={(v) => go({ status: v === ALL ? null : v })}>
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get("client") ?? ALL} onValueChange={(v) => go({ client: v === ALL ? null : v })}>
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Client">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              go({ status: null, client: null, q: null });
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-navy"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <p className="basis-full text-xs text-slate-500">
        <span className="font-semibold text-navy tabular-nums">{total}</span> {total === 1 ? "entry" : "entries"} ·{" "}
        <span className="font-semibold text-navy tabular-nums">{totalHours.toFixed(2)}</span> hrs
      </p>
    </div>
  );
}

// Clickable column header: date sorts newest-first on the first click, the
// others A→Z / low→high.
export function SortHeader({ k, label, className }: { k: string; label: string; className?: string }) {
  const params = useSearchParams();
  const href = useHref();
  const sort = params.get("sort") ?? "date";
  const dir = params.get("dir") ?? (sort === "date" ? "desc" : "asc");
  const active = sort === k;
  const nextDir = active ? (dir === "asc" ? "desc" : "asc") : k === "date" ? "desc" : "asc";
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={href({ sort: k, dir: nextDir })}
        scroll={false}
        className={cn("inline-flex items-center gap-1 hover:text-navy", active && "text-navy")}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
      </Link>
    </th>
  );
}

export function Pagination({ page, pages, total, pageSize }: { page: number; pages: number; total: number; pageSize: number }) {
  const href = useHref();
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // First, last, and two either side of the current page.
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500 tabular-nums">
        Showing {from}–{to} of {total}
      </p>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <PageLink href={href({ page: String(page - 1) })} disabled={page === 1} className={btn} label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </PageLink>
          {nums.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-xs text-slate-400">…</span>}
              <Link
                href={href({ page: String(n) })}
                scroll={false}
                aria-current={n === page ? "page" : undefined}
                className={cn(btn, n === page ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                {n}
              </Link>
            </span>
          ))}
          <PageLink href={href({ page: String(page + 1) })} disabled={page === pages} className={btn} label="Next page">
            <ChevronRight className="h-4 w-4" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  className,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  className: string;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled)
    return (
      <span aria-disabled className={cn(className, "text-slate-300")}>
        {children}
      </span>
    );
  return (
    <Link href={href} scroll={false} aria-label={label} className={cn(className, "text-slate-600 hover:bg-slate-100")}>
      {children}
    </Link>
  );
}
