"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Lock, Plus, RotateCcw, Save, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { computeContractTotals, formatMoney, formatScaled, isValidDecimal2, toHundredths } from "@/lib/contract-calc";
import { cn } from "@/lib/utils";
import { CONTRACT_TYPE_LABEL, type ContractType } from "./contract-type";

export type MasterOpt = { id: number; code: string; description: string | null; isActive: boolean };
export type ContractMasters = {
  CLIENT: MasterOpt[];
  CURRENCY: MasterOpt[];
  RESOURCE_TYPE: MasterOpt[];
  TASK: MasterOpt[];
};
export type ContractStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export type ContractFormValue = {
  id?: number;
  status: ContractStatus;
  code: string;
  description: string;
  clientId: string;
  currencyId: string;
  type: ContractType;
  rates: { resourceTypeId: string; ratePerHour: string; hours?: string }[];
  tasks: { taskMasterId: string; isMilestone?: boolean; hours: Record<string, string> }[];
};

type RateRow = { key: number; resourceTypeId: string; ratePerHour: string; hours: string };
type TaskRow = { key: number; taskMasterId: string; isMilestone: boolean; hours: Record<string, string> };

let keySeq = 0;
const nextKey = () => ++keySeq;

const STATUS_BADGE: Record<ContractStatus, { label: string; variant: "warning" | "success" | "default" }> = {
  DRAFT: { label: "Draft", variant: "warning" },
  ACTIVE: { label: "Active", variant: "success" },
  CLOSED: { label: "Closed", variant: "default" },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const b = STATUS_BADGE[status];
  return <Badge variant={b.variant}>{b.label}</Badge>;
}

const hasHours = (h: string | undefined) => !!h && isValidDecimal2(h) && Number(h) !== 0;

export function ContractEditor({
  initial,
  masters,
  canEdit,
  canDelete,
}: {
  initial: ContractFormValue;
  masters: ContractMasters;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const isNew = initial.id === undefined;
  const status = initial.status;
  const readOnly = !canEdit || status === "CLOSED";
  const headerLocked = readOnly || status === "ACTIVE";

  const [code, setCode] = useState(initial.code);
  const [description, setDescription] = useState(initial.description);
  const [clientId, setClientId] = useState(initial.clientId);
  const [currencyId, setCurrencyId] = useState(initial.currencyId);
  const [type, setType] = useState<ContractType>(initial.type);
  const [rates, setRates] = useState<RateRow[]>(() =>
    initial.rates.map((r) => ({ key: nextKey(), ...r, hours: r.hours ?? "0" }))
  );
  const [tasks, setTasks] = useState<TaskRow[]>(() =>
    initial.tasks.map((t) => ({ key: nextKey(), ...t, isMilestone: !!t.isMilestone }))
  );
  // Role rates table: per row rate × hours, plus totals.
  // Invalid cells count as 0 while typing.
  const h100 = (v: string | undefined) => (v ? toHundredths(v) ?? BigInt(0) : BigInt(0));
  const rowAmount4 = (r: { ratePerHour: string; hours: string }) => h100(r.ratePerHour) * h100(r.hours);
  const roleHours100 = rates.reduce((sum, r) => sum + h100(r.hours), BigInt(0));
  const roleHoursTotal = formatScaled(roleHours100, 2);
  const roleAmountTotal = formatScaled(rates.reduce((sum, r) => sum + rowAmount4(r), BigInt(0)), 4);
  const isMilestoneType = type === "MILESTONE";
  const [busy, setBusy] = useState<null | "save" | "activate" | "close" | "reopen" | "delete">(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: () => void; danger?: boolean }>(
    null
  );

  const byId = (list: MasterOpt[]) => new Map(list.map((m) => [String(m.id), m]));
  const roleMap = useMemo(() => byId(masters.RESOURCE_TYPE), [masters]);
  const taskMap = useMemo(() => byId(masters.TASK), [masters]);
  const currency = masters.CURRENCY.find((c) => String(c.id) === currencyId)?.code ?? "";

  // Role columns of the budget grid = roles chosen in the rate table.
  const roleCols = useMemo(() => rates.filter((r) => r.resourceTypeId), [rates]);

  const totals = useMemo(
    () =>
      computeContractTotals({
        rates: roleCols.map((r) => ({ resourceTypeId: Number(r.resourceTypeId), ratePerHour: r.ratePerHour || "0" })),
        tasks: tasks.map((t) => ({
          taskMasterId: Number(t.taskMasterId) || 0,
          hours: Object.fromEntries(Object.entries(t.hours).map(([k, v]) => [Number(k), v])),
        })),
      }),
    [roleCols, tasks]
  );

  // ---------- inline validation ----------
  const usedRoles = new Set(rates.map((r) => r.resourceTypeId).filter(Boolean));
  const usedTasks = new Set(tasks.map((t) => t.taskMasterId).filter(Boolean));
  const problems: string[] = [];
  if (!code.trim()) problems.push("SOW Code is required");
  else if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(code.trim())) problems.push("SOW Code: letters, digits and . _ / - only");
  if (!clientId) problems.push("Select a client");
  if (!currencyId) problems.push("Select a currency");
  if (rates.some((r) => !r.resourceTypeId)) problems.push("Every rate row needs a role");
  if (rates.some((r) => !isValidDecimal2(r.ratePerHour))) problems.push("Rates must be non-negative, up to 2 decimals");
  if (rates.some((r) => !isValidDecimal2(r.hours)))
    problems.push("Role hours must be non-negative, up to 2 decimals");
  if (tasks.some((t) => !t.taskMasterId)) problems.push("Every task row needs a task");
  if (tasks.some((t) => roleCols.some((r) => t.hours[r.resourceTypeId] && !isValidDecimal2(t.hours[r.resourceTypeId]))))
    problems.push("Hours must be non-negative, up to 2 decimals");

  // ---------- rate rows ----------
  const addRate = () => setRates((rs) => [...rs, { key: nextKey(), resourceTypeId: "", ratePerHour: "0", hours: "0" }]);
  const updateRate = (key: number, patch: Partial<RateRow>) =>
    setRates((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const dropRole = (row: RateRow) => {
    setRates((rs) => rs.filter((r) => r.key !== row.key));
    if (row.resourceTypeId) {
      setTasks((ts) =>
        ts.map((t) => {
          const { [row.resourceTypeId]: _removed, ...rest } = t.hours;
          void _removed;
          return { ...t, hours: rest };
        })
      );
    }
  };
  const removeRate = (row: RateRow) => {
    const withHours = row.resourceTypeId ? tasks.filter((t) => hasHours(t.hours[row.resourceTypeId])).length : 0;
    if (withHours === 0) return dropRole(row);
    const roleCode = roleMap.get(row.resourceTypeId)?.code ?? "this role";
    setConfirm({
      title: `Remove ${roleCode}?`,
      body: `${withHours} task row(s) have ${roleCode} hours. Removing the role deletes its column and those hours.`,
      danger: true,
      action: () => dropRole(row),
    });
  };
  const changeRateRole = (row: RateRow, newRole: string) => {
    // Carry the column's hours over to the newly chosen role.
    setTasks((ts) =>
      ts.map((t) => {
        if (!row.resourceTypeId || !(row.resourceTypeId in t.hours)) return t;
        const { [row.resourceTypeId]: h, ...rest } = t.hours;
        return { ...t, hours: { ...rest, [newRole]: h } };
      })
    );
    updateRate(row.key, { resourceTypeId: newRole });
  };

  // ---------- task rows ----------
  const addTask = () => setTasks((ts) => [...ts, { key: nextKey(), taskMasterId: "", isMilestone: false, hours: {} }]);
  const updateTask = (key: number, patch: Partial<TaskRow>) =>
    setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const setHours = (key: number, role: string, value: string) =>
    setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, hours: { ...t.hours, [role]: value } } : t)));
  const removeTask = (row: TaskRow) => {
    const any = Object.values(row.hours).some(hasHours);
    if (!any) return setTasks((ts) => ts.filter((t) => t.key !== row.key));
    const taskCode = taskMap.get(row.taskMasterId)?.code ?? "this task";
    setConfirm({
      title: `Remove ${taskCode}?`,
      body: "This row has budgeted hours. They will be removed when you save.",
      danger: true,
      action: () => setTasks((ts) => ts.filter((t) => t.key !== row.key)),
    });
  };

  // ---------- persistence ----------
  const payload = () => ({
    code: code.trim(),
    description: description.trim() || null,
    clientId: Number(clientId),
    currencyId: Number(currencyId),
    type,
    rates: roleCols.map((r) => ({
      resourceTypeId: Number(r.resourceTypeId),
      ratePerHour: r.ratePerHour.trim(),
      hours: r.hours.trim(),
    })),
    tasks: tasks.map((t) => ({
      taskMasterId: Number(t.taskMasterId),
      isMilestone: isMilestoneType && t.isMilestone,
      hours: Object.fromEntries(
        roleCols.map((r) => [r.resourceTypeId, (t.hours[r.resourceTypeId] ?? "").trim() || "0"])
      ),
    })),
  });

  async function save(): Promise<number | null> {
    setCodeError(null);
    const res = await fetch(isNew ? "/api/contracts" : `/api/contracts/${initial.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409) setCodeError(j.error);
      const fieldErr = j.details?.fieldErrors ? Object.values(j.details.fieldErrors).flat()[0] : null;
      toast.error((fieldErr as string) || j.error || "Save failed");
      return null;
    }
    return j.data.id as number;
  }

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const onSave = (activate: boolean) =>
    run(activate ? "activate" : "save", async () => {
      if (problems.length) {
        toast.error(problems[0]);
        return;
      }
      const id = await save();
      if (!id) return;
      if (activate) {
        const res = await fetch(`/api/contracts/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "activate" }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(`Saved as draft, but not activated: ${j.error ?? "error"}`);
        } else toast.success("Contract saved and activated");
      } else toast.success(isNew ? "Draft saved" : "Contract saved");
      if (isNew) router.push(`/admin/contracts/${id}`);
      router.refresh();
    });

  const transition = (action: "close" | "reopen") =>
    run(action, async () => {
      const res = await fetch(`/api/contracts/${initial.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(j.error ?? "Failed");
      toast.success(action === "close" ? "Contract closed" : "Contract re-opened");
      router.refresh();
    });

  const remove = () =>
    run("delete", async () => {
      const res = await fetch(`/api/contracts/${initial.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(j.error ?? "Delete failed");
      toast.success("Draft deleted");
      router.push("/admin/contracts");
      router.refresh();
    });

  const optionsFor = (list: MasterOpt[], current: string, used?: Set<string>) =>
    list.filter((m) => String(m.id) === current || (m.isActive && !used?.has(String(m.id))));

  const money = (a: string) => formatMoney(a, currency);

  // Shared by the Budgets and Hours views of the task section.
  const taskSelect = (t: TaskRow) => (
    <Select value={t.taskMasterId || undefined} onValueChange={(v) => updateTask(t.key, { taskMasterId: v })} disabled={readOnly}>
      <SelectTrigger>
        <SelectValue placeholder="Select task" />
      </SelectTrigger>
      <SelectContent>
        {optionsFor(masters.TASK, t.taskMasterId, usedTasks).map((m) => (
          <SelectItem key={m.id} value={String(m.id)}>
            {m.code}
            {m.description ? ` — ${m.description}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const taskDelete = (t: TaskRow) =>
    !readOnly && (
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => removeTask(t)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    );
  const noTasksRow = (colSpan: number) =>
    tasks.length === 0 && (
      <TableRow>
        <TableCell colSpan={colSpan} className="text-center text-sm text-slate-500 py-8">
          {roleCols.length === 0 ? "Add a role rate first." : "No tasks yet."}
        </TableCell>
      </TableRow>
    );
  const milestones = tasks
    .map((t, i) => ({ t, total: totals.taskTotals[i] }))
    .filter(({ t }) => t.isMilestone && t.taskMasterId);

  const msCol = isMilestoneType ? 1 : 0;
  const budgetsGrid = (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {isMilestoneType && <TableHead className="w-24 text-center">Milestone</TableHead>}
            <TableHead className="min-w-[220px]">Tasks</TableHead>
            {roleCols.map((r) => (
              <TableHead key={r.key} className="text-right min-w-[110px]">
                {roleMap.get(r.resourceTypeId)?.code}
              </TableHead>
            ))}
            <TableHead className="text-right min-w-[110px]">Total Hours</TableHead>
            <TableHead className="text-right min-w-[140px]">Total Amount</TableHead>
            {!readOnly && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {noTasksRow(roleCols.length + 4 + msCol)}
          {tasks.map((t, i) => (
            <TableRow key={t.key}>
              {isMilestoneType && (
                <TableCell className="text-center">
                  <Checkbox
                    aria-label="Milestone"
                    checked={t.isMilestone}
                    disabled={readOnly}
                    onCheckedChange={(v) => updateTask(t.key, { isMilestone: v === true })}
                  />
                </TableCell>
              )}
              <TableCell>{taskSelect(t)}</TableCell>
              {roleCols.map((r) => {
                const v = t.hours[r.resourceTypeId] ?? "";
                return (
                  <TableCell key={r.key} className="text-right">
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      value={v}
                      disabled={readOnly}
                      onChange={(e) => setHours(t.key, r.resourceTypeId, e.target.value)}
                      className={cn("text-right tabular-nums w-24 ml-auto", v && !isValidDecimal2(v) && "border-red-500")}
                    />
                  </TableCell>
                );
              })}
              <TableCell className="text-right font-semibold tabular-nums">{totals.taskTotals[i]?.hours}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{money(totals.taskTotals[i]?.amount ?? "0.00")}</TableCell>
              {taskDelete(t)}
            </TableRow>
          ))}
          <TableRow className="bg-slate-50 font-semibold">
            <TableCell colSpan={1 + msCol}>Total Hours</TableCell>
            {totals.roleTotals.map((rt) => (
              <TableCell key={rt.resourceTypeId} className="text-right tabular-nums">
                {rt.hours}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums">{totals.totalHours}</TableCell>
            <TableCell />
            {!readOnly && <TableCell />}
          </TableRow>
          <TableRow className="bg-slate-50 font-semibold text-navy">
            <TableCell colSpan={1 + msCol}>Total Amount</TableCell>
            {totals.roleTotals.map((rt) => (
              <TableCell key={rt.resourceTypeId} className="text-right tabular-nums">
                {formatMoney(rt.amount)}
              </TableCell>
            ))}
            <TableCell />
            <TableCell className="text-right tabular-nums">{money(totals.totalAmount)}</TableCell>
            {!readOnly && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
  // Milestone hours must add up to the Role rates hours.
  const milestoneHours100 = milestones.reduce((sum, { total }) => sum + h100(total?.hours), BigInt(0));
  const milestoneHoursMatch = milestoneHours100 === roleHours100;

  const milestonesGrid = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Milestone</TableHead>
          <TableHead className="text-right w-32">Hours</TableHead>
          <TableHead className="text-right w-44">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {milestones.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-sm text-slate-500 py-8">
              No milestones yet. Tick Milestone on a task in Budgets.
            </TableCell>
          </TableRow>
        )}
        {milestones.map(({ t, total }, n) => {
          const m = taskMap.get(t.taskMasterId);
          return (
            <TableRow key={t.key}>
              <TableCell className="tabular-nums text-slate-500">{n + 1}</TableCell>
              <TableCell>
                <span className="font-mono text-xs font-medium text-navy">{m?.code}</span>
                {m?.description && <span className="ml-2 text-sm text-slate-600">{m.description}</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{total?.hours}</TableCell>
              <TableCell className="text-right tabular-nums">{money(total?.amount ?? "0.00")}</TableCell>
            </TableRow>
          );
        })}
        <TableRow
          className={cn(
            "font-semibold",
            milestoneHoursMatch ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          )}
        >
          <TableCell colSpan={2}>
            Total Hours
            <span className="ml-2 text-xs font-normal">
              {milestoneHoursMatch
                ? "matches Role rates"
                : `Role rates total is ${roleHoursTotal}`}
            </span>
          </TableCell>
          <TableCell className="text-right tabular-nums">{formatScaled(milestoneHours100, 2)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {money(formatScaled(milestones.reduce((sum, { total }) => sum + h100(total?.amount), BigInt(0)), 2))}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/contracts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> All contracts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && <ContractStatusBadge status={status} />}
          {readOnly && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5" /> Read-only
            </span>
          )}
        </div>
      </div>

      {/* ---------- Header ---------- */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sow-code">SOW Code</Label>
            <Input
              id="sow-code"
              value={code}
              disabled={headerLocked}
              placeholder="STC/SOW/08OCT2025/01"
              className={cn("font-mono uppercase", codeError && "border-red-500")}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
            />
            {codeError ? (
              <p className="text-xs text-red-600">{codeError}</p>
            ) : (
              <p className="text-xs text-slate-500">Unique. Also used as the PO reference in MIS.</p>
            )}
          </div>
          <div className="space-y-2 md:row-span-2">
            <Label htmlFor="sow-desc">Description</Label>
            <Textarea
              id="sow-desc"
              rows={5}
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContractType)} disabled={headerLocked}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONTRACT_TYPE_LABEL) as ContractType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {CONTRACT_TYPE_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId || undefined} onValueChange={setClientId} disabled={headerLocked}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {optionsFor(masters.CLIENT, clientId).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.code}
                      {m.description ? ` — ${m.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currencyId || undefined} onValueChange={setCurrencyId} disabled={headerLocked}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {optionsFor(masters.CURRENCY, currencyId).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.code}
                      {m.description ? ` — ${m.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* ---------- Role rates ---------- */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="font-display font-semibold text-navy">Role rates</h3>
            <p className="text-xs text-slate-500">Each role becomes a column in the task budget below.</p>
          </div>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={addRate}>
              <Plus className="h-4 w-4" /> Add New Entry
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="text-right w-40">Hours</TableHead>
              <TableHead className="text-right w-48">Rate / Hour</TableHead>
              <TableHead className="text-right w-44">Total</TableHead>
              <TableHead className="w-28">Currency</TableHead>
              {!readOnly && <TableHead className="text-right w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-slate-500 py-8">
                  No roles yet. Add a role to start budgeting.
                </TableCell>
              </TableRow>
            )}
            {rates.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  <Select value={r.resourceTypeId || undefined} onValueChange={(v) => changeRateRole(r, v)} disabled={readOnly}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsFor(masters.RESOURCE_TYPE, r.resourceTypeId, usedRoles).map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.code}
                          {m.description ? ` — ${m.description}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    inputMode="decimal"
                    value={r.ratePerHour}
                    disabled={readOnly}
                    onChange={(e) => updateRate(r.key, { ratePerHour: e.target.value })}
                    className={cn("text-right tabular-nums ml-auto w-40", !isValidDecimal2(r.ratePerHour) && "border-red-500")}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    inputMode="decimal"
                    aria-label="Role hours"
                    value={r.hours}
                    disabled={readOnly}
                    onChange={(e) => updateRate(r.key, { hours: e.target.value })}
                    className={cn("text-right tabular-nums ml-auto w-32", !isValidDecimal2(r.hours) && "border-red-500")}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney(formatScaled(rowAmount4(r), 4))}</TableCell>
                <TableCell className="font-mono text-xs text-slate-600">{currency || "—"}</TableCell>
                {!readOnly && (
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => removeRate(r)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rates.length > 0 && (
              <TableRow className="bg-slate-50 font-semibold text-navy">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right tabular-nums pr-7">{roleHoursTotal}</TableCell>
                <TableCell className="text-right tabular-nums">{money(roleAmountTotal)}</TableCell>
                <TableCell colSpan={readOnly ? 1 : 2} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ---------- Task budget ---------- */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="font-display font-semibold text-navy">{isMilestoneType ? "Task budget" : "Task budget (hours)"}</h3>
            <p className="text-xs text-slate-500">
              {isMilestoneType
                ? "Tick Milestone on a task in Budgets to list it under the Milestone tab."
                : "Totals update as you type. The server recalculates them on save."}
            </p>
          </div>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={addTask} disabled={roleCols.length === 0}>
              <Plus className="h-4 w-4" /> Add Tasks
            </Button>
          )}
        </div>
        {isMilestoneType ? (
          <Tabs defaultValue="budgets">
            <TabsList className="mx-5 mb-3">
              <TabsTrigger value="budgets">Budgets</TabsTrigger>
              <TabsTrigger value="milestone">Milestone</TabsTrigger>
            </TabsList>
            <TabsContent value="budgets">{budgetsGrid}</TabsContent>
            <TabsContent value="milestone">{milestonesGrid}</TabsContent>
          </Tabs>
        ) : (
          budgetsGrid
        )}
      </Card>

      {/* ---------- Actions ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {!isNew && status === "DRAFT" && canDelete && (
            <Button
              variant="outline"
              className="text-red-600"
              disabled={!!busy}
              onClick={() =>
                setConfirm({
                  title: "Delete draft?",
                  body: `Delete ${initial.code} permanently? This cannot be undone.`,
                  danger: true,
                  action: remove,
                })
              }
            >
              {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete draft
            </Button>
          )}
          {status === "ACTIVE" && canDelete && (
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                setConfirm({
                  title: "Close contract?",
                  body: "A closed contract becomes read-only, can't be picked for new Activities, and no new time can be logged against it. History is kept, and you can re-open it later.",
                  action: () => transition("close"),
                })
              }
            >
              {busy === "close" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Close
            </Button>
          )}
          {status === "CLOSED" && canDelete && (
            <Button variant="outline" disabled={!!busy} onClick={() => transition("reopen")}>
              {busy === "reopen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Re-open
            </Button>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant={status === "ACTIVE" ? "default" : "outline"} disabled={!!busy} onClick={() => onSave(false)}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {status === "ACTIVE" ? "Save changes" : "Save Draft"}
            </Button>
            {status === "DRAFT" && (
              <Button disabled={!!busy} onClick={() => onSave(true)}>
                {busy === "activate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save & Activate
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              className={confirm?.danger ? "bg-red-600 hover:bg-red-700" : undefined}
              onClick={() => {
                const a = confirm?.action;
                setConfirm(null);
                a?.();
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
