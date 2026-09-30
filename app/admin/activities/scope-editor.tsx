"use client";

import { Plus, Trash2, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Brief = { id: number; code: string; description: string | null };

// ACTIVE contracts are selectable; others are listed only so an Activity
// already on a closed contract still renders.
export type ContractLite = {
  id: number;
  code: string;
  description: string | null;
  clientId: number;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  tasks: { id: number; taskMaster: Brief }[];
  roles: Brief[];
};
export type UserOption = { id: number; name: string; employeeCode: string };

export type ScopeValue = {
  contractId: string;
  taskIds: number[];
  members: { userId: string; resourceTypeId: string }[];
};

export const emptyScope: ScopeValue = { contractId: "", taskIds: [], members: [] };

// Returns the first problem with a scope, or null when it can be saved.
export function scopeProblem(v: ScopeValue): string | null {
  if (!v.contractId) return "Select the Contract / SOW";
  if (v.taskIds.length === 0) return "Select at least one task from the contract";
  if (v.members.some((m) => !m.userId || !m.resourceTypeId)) return "Every member needs a person and a role";
  const ids = v.members.map((m) => m.userId);
  if (new Set(ids).size !== ids.length) return "A person is listed twice";
  return null;
}

export function scopePayload(v: ScopeValue) {
  return {
    contractId: Number(v.contractId),
    contractTaskIds: v.taskIds,
    members: v.members.map((m) => ({ userId: Number(m.userId), resourceTypeId: Number(m.resourceTypeId) })),
  };
}

const label = (m: Brief) => (m.description ? `${m.code} — ${m.description}` : m.code);

export function ScopeEditor({
  clientId,
  contracts,
  users,
  value,
  onChange,
}: {
  clientId: string;
  contracts: ContractLite[];
  users: UserOption[];
  value: ScopeValue;
  onChange: (v: ScopeValue) => void;
}) {
  const options = contracts.filter(
    (c) => String(c.clientId) === clientId && (c.status === "ACTIVE" || String(c.id) === value.contractId)
  );
  const contract = contracts.find((c) => String(c.id) === value.contractId);

  const toggleTask = (id: number, on: boolean) =>
    onChange({ ...value, taskIds: on ? [...value.taskIds, id] : value.taskIds.filter((x) => x !== id) });
  const setMember = (i: number, patch: Partial<ScopeValue["members"][number]>) =>
    onChange({ ...value, members: value.members.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  return (
    <div className="space-y-4 rounded-md border border-slate-200 p-3">
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <FileSignature className="h-3.5 w-3.5" /> Contract / SOW
        </Label>
        <Select
          value={value.contractId || undefined}
          disabled={!clientId}
          onValueChange={(v) => {
            const next = contracts.find((c) => String(c.id) === v);
            const roles = new Set(next?.roles.map((r) => String(r.id)));
            onChange({
              contractId: v,
              // Pre-select every SOW task; staff untick the ones this Activity won't deliver.
              taskIds: next?.tasks.map((t) => t.id) ?? [],
              members: value.members.map((m) => (roles.has(m.resourceTypeId) ? m : { ...m, resourceTypeId: "" })),
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={clientId ? "Select contract" : "Select a client first"} />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-slate-400">No active contracts for this client</div>
            ) : (
              options.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.code}
                  {c.description ? ` — ${c.description}` : ""}
                  {c.status !== "ACTIVE" && ` (${c.status.toLowerCase()})`}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {contract && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tasks from {contract.code}</Label>
              <span className="text-xs text-slate-500">
                {value.taskIds.length} of {contract.tasks.length} selected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {contract.tasks.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50"
                >
                  <Checkbox checked={value.taskIds.includes(t.id)} onCheckedChange={(v) => toggleTask(t.id, v === true)} />
                  <Badge variant="brand" className="font-mono">
                    {t.taskMaster.code}
                  </Badge>
                  <span className="truncate text-slate-600">{t.taskMaster.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Members (who can log time)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChange({ ...value, members: [...value.members, { userId: "", resourceTypeId: "" }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add member
              </Button>
            </div>
            {value.members.length === 0 && (
              <p className="text-xs text-amber-700">No members yet. Only members can log time on this Activity.</p>
            )}
            {value.members.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={m.userId || undefined} onValueChange={(v) => setMember(i, { userId: v })}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Person" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => String(u.id) === m.userId || !value.members.some((x) => x.userId === String(u.id)))
                      .map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} ({u.employeeCode})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={m.resourceTypeId || undefined} onValueChange={(v) => setMember(i, { resourceTypeId: v })}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {contract.roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {label(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => onChange({ ...value, members: value.members.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
