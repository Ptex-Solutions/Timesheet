"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge } from "@/components/shared/role-badge";
import { cn } from "@/lib/utils";
import {
  ACTION_LABELS,
  BASE_ACTIONS,
  MODULES,
  ROLE_LABELS,
  roleDefaults,
  type Action,
  type Permission,
} from "@/lib/permissions";
import type { AccessUser } from "@/lib/access-data";

type ModuleDef = (typeof MODULES)[number];

function perm(module: string, action: string) {
  return `${module}.${action}` as Permission;
}

function moduleHas(m: ModuleDef, action: Action) {
  return (m.actions as readonly Action[]).includes(action);
}

function sameSet(a: Set<Permission>, b: Set<Permission>) {
  if (a.size !== b.size) return false;
  for (const p of a) if (!b.has(p)) return false;
  return true;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function AccessPanel({
  users: initialUsers,
  canEdit,
  actorPerms,
}: {
  users: AccessUser[];
  canEdit: boolean;
  actorPerms: Permission[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [selectedId, setSelectedId] = useState<number | null>(initialUsers[0]?.id ?? null);
  const [draft, setDraft] = useState<Set<Permission>>(() => new Set(initialUsers[0]?.effective ?? []));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Pick up fresh server data after router.refresh().
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const selected = users.find((u) => u.id === selectedId) ?? users[0] ?? null;
  // Tracks the currently shown user so async save/reset results for another
  // user never overwrite this user's draft.
  const selectedRef = useRef<number | null>(selected?.id ?? null);
  selectedRef.current = selected?.id ?? null;

  // Reset the draft whenever the selected user or their saved state changes.
  const savedKey = selected ? `${selected.id}:${[...selected.effective].sort().join(",")}` : "";
  useEffect(() => {
    setDraft(new Set(selected?.effective ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const actorSet = useMemo(() => new Set(actorPerms), [actorPerms]);
  const saved = useMemo(() => new Set(selected?.effective ?? []), [selected]);
  const defaults = useMemo(() => (selected ? roleDefaults(selected.role) : new Set<Permission>()), [selected]);

  if (!selected) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          No active managers or admins found.
        </CardContent>
      </Card>
    );
  }

  const isSuperAdmin = selected.role === "SUPER_ADMIN";
  const editable = selected.editable && !isSuperAdmin;
  const dirty = !sameSet(draft, saved);
  const busy = saving || resetting;

  // The actor may only grant permissions they hold, unless the target already
  // has it saved (re-checking something the draft just unchecked).
  const canGrant = (p: Permission) => saved.has(p) || actorSet.has(p);

  function disabledReason(p: Permission): string | null {
    if (!editable) return null; // whole grid is read-only; explained in the note
    if (draft.has(p)) return null; // unchecking is always allowed
    if (!canGrant(p)) return "You don't have this permission";
    const [mod, action] = p.split(".");
    const view = perm(mod, "view");
    if (action !== "view" && !draft.has(view) && !canGrant(view)) {
      return "You don't have this permission";
    }
    return null;
  }

  function toggle(p: Permission, checked: boolean) {
    const [mod, action] = p.split(".");
    setDraft((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(p);
        if (action !== "view") next.add(perm(mod, "view"));
      } else {
        next.delete(p);
        if (action === "view") {
          for (const q of Array.from(next)) if (q.startsWith(`${mod}.`)) next.delete(q);
        }
      }
      return next;
    });
  }

  function applyResult(userId: number, effective: Permission[], overrides: AccessUser["overrides"]) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, effective, overrides } : u)));
    if (selectedRef.current === userId) setDraft(new Set(effective));
    router.refresh();
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/access/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: Array.from(draft) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error ?? "Failed to save permissions");
        return;
      }
      applyResult(selected.id, j.data.effective, j.data.overrides);
      toast.success(`Permissions updated for ${selected.name}`);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!selected) return;
    setResetting(true);
    try {
      const r = await fetch(`/api/access/${selected.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error ?? "Failed to reset permissions");
        return;
      }
      applyResult(selected.id, j.data.effective, j.data.overrides);
      setConfirmReset(false);
      toast.success(`${selected.name} reset to ${ROLE_LABELS[selected.role]} defaults`);
    } finally {
      setResetting(false);
    }
  }

  // Plain render helper (not a component) so checkboxes keep focus across renders.
  function permCheckbox(p: Permission, label?: string) {
    const checked = isSuperAdmin || draft.has(p);
    const differs = !isSuperAdmin && checked !== defaults.has(p);
    const reason = disabledReason(p);
    const disabled = !editable || busy || reason !== null;
    const title =
      reason ?? (differs && selected ? `Overrides ${ROLE_LABELS[selected.role]} default` : undefined);
    const id = `perm-${selected!.id}-${p}`;
    return (
      <span
        title={title}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1",
          differs && "bg-amber-50 ring-1 ring-amber-300"
        )}
      >
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => toggle(p, v === true)}
          aria-label={label ?? p}
        />
        {label && (
          <label
            htmlFor={id}
            className={cn("text-xs font-medium text-slate-600", disabled ? "cursor-not-allowed" : "cursor-pointer")}
          >
            {label}
          </label>
        )}
      </span>
    );
  }

  let note: string | null = null;
  if (isSuperAdmin) note = "Full access — Super Admin permissions can't be changed.";
  else if (!canEdit) note = "You have view-only access to the Access Panel.";
  else if (!selected.editable)
    note = "Only a higher-ranked admin with Access Panel edit can change this user.";

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Staff list */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Staff</CardTitle>
          <CardDescription>{users.length} active managers & admins</CardDescription>
        </CardHeader>
        <ul className="divide-y divide-slate-100 p-2">
          {users.map((u) => {
            const active = u.id === selected.id;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  disabled={busy}
                  className={cn(
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    active ? "bg-brand-50 ring-1 ring-brand/30" : "hover:bg-slate-50"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", active ? "text-brand-700" : "text-navy")}>
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                    {u.overrides.length > 0 && (
                      <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                        {u.overrides.length} override{u.overrides.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  <RoleBadge role={u.role} className="shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Permission matrix */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              {selected.name}
            </CardTitle>
            <CardDescription>
              {selected.email} · <span className="font-mono text-xs">{selected.employeeCode}</span>
            </CardDescription>
          </div>
          <RoleBadge role={selected.role} />
        </CardHeader>
        <CardContent className="space-y-4">
          {note && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>{note}</span>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Module</TableHead>
                {BASE_ACTIONS.map((a) => (
                  <TableHead key={a} className="text-center">
                    {ACTION_LABELS[a]}
                  </TableHead>
                ))}
                <TableHead>Special</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULES.map((m) => {
                const special = (m.actions as readonly Action[]).filter((a) => !BASE_ACTIONS.includes(a));
                return (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium text-navy">{m.label}</TableCell>
                    {BASE_ACTIONS.map((a) => (
                      <TableCell key={a} className="text-center">
                        {moduleHas(m, a) ? permCheckbox(perm(m.key, a)) : null}
                      </TableCell>
                    ))}
                    <TableCell>
                      {special.length ? (
                        <div className="flex flex-wrap gap-2">
                          {special.map((a) => (
                            <span key={a}>{permCheckbox(perm(m.key, a), ACTION_LABELS[a])}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block h-3.5 w-3.5 rounded bg-amber-50 ring-1 ring-amber-300" />
            Differs from the {ROLE_LABELS[selected.role]} role default
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <Button
            variant="outline"
            disabled={!editable || busy || (selected.overrides.length === 0 && !dirty)}
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="h-4 w-4" /> Reset to role defaults
          </Button>
          <div className="flex items-center gap-3">
            {dirty && editable && (
              <span className="text-xs font-medium text-amber-700">Unsaved changes</span>
            )}
            <Button disabled={!editable || !dirty || busy} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={confirmReset} onOpenChange={(o) => !resetting && setConfirmReset(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to role defaults?</DialogTitle>
            <DialogDescription>
              This removes all custom permission overrides for {selected.name}. They will have the
              standard {ROLE_LABELS[selected.role]} permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={resetting} onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={resetting} onClick={reset}>
              {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
