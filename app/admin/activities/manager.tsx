"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Layers, ListChecks, Loader2, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActivityMasterType } from "@/lib/master-types";
import { ActivityDetails, EditTasksDialog, type DetailTab } from "./details";
import { readJson, type ActivityRow as Activity, type ActivityTask as Task, type MasterBrief } from "./types";
import {
  ScopeEditor,
  emptyScope,
  scopePayload,
  scopeProblem,
  type ContractLite,
  type ScopeValue,
  type UserOption,
} from "./scope-editor";

export type { ContractLite, UserOption };

export type MasterType = ActivityMasterType;
export type MasterOption = { id: number; code: string; description: string | null; isActive: boolean };
export type MastersByType = Record<MasterType, MasterOption[]>;

function scopeOf(a: Activity): ScopeValue {
  if (!a.contract) return emptyScope;
  return {
    contractId: String(a.contract.id),
    // Selected = assigned to the Activity, active or not (active is a separate flag).
    taskIds: a.tasks.filter((t) => t.contractTaskId !== null).map((t) => t.contractTaskId!),
    members: a.members.map((m) => ({
      userId: String(m.userId),
      resourceTypeId: String(m.resourceTypeId),
      isActive: m.isActive,
    })),
  };
}

const NONE = "__none__";

// Order matters: it's the order the selects render in the create dialog.
const ID_FIELDS: { key: "clientId" | "typeId" | "productId" | "versionId" | "moduleId"; type: MasterType; label: string }[] = [
  { key: "clientId", type: "CLIENT", label: "Client" },
  { key: "typeId", type: "TYPE", label: "Type" },
  { key: "productId", type: "PRODUCT", label: "Product" },
  { key: "versionId", type: "VERSION", label: "Version" },
  { key: "moduleId", type: "MODULE", label: "Module" },
];

function masterLabel(m: MasterBrief) {
  return m.description ? `${m.code} — ${m.description}` : m.code;
}

export function ActivitiesPanel({
  activities,
  masters,
  contracts,
  users,
  canEdit,
  canDelete,
}: {
  activities: Activity[];
  masters: MastersByType;
  contracts: ContractLite[];
  users: UserOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ task?: Task; activity: Activity } | null>(null);
  const [editingTasks, setEditingTasks] = useState<Activity | null>(null);
  const [tabs, setTabs] = useState<Record<number, DetailTab>>({});
  const contractById = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts]);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const visible = useMemo(
    () => (clientFilter === "all" ? activities : activities.filter((a) => String(a.client.id) === clientFilter)),
    [activities, clientFilter]
  );

  // Only clients that actually have activities are useful as a filter.
  const filterClients = useMemo(() => {
    const seen = new Map<number, MasterBrief>();
    for (const a of activities) seen.set(a.client.id, a.client);
    return Array.from(seen.values()).sort((x, y) => x.code.localeCompare(y.code));
  }, [activities]);

  function toggle(id: number) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }

  function openTab(id: number, tab: DetailTab) {
    setExpanded((prev) => new Set(prev).add(id));
    setTabs((t) => ({ ...t, [id]: tab }));
  }

  async function setActive(a: Activity, isActive: boolean) {
    setTogglingId(a.id);
    try {
      const r = await fetch("/api/activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, isActive }),
      });
      const j = await readJson(r);
      if (!r.ok) {
        toast.error(j.error || "Update failed");
        return;
      }
      toast.success(isActive ? "Activity activated" : "Activity deactivated");
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div className="w-full sm:w-64 space-y-2">
          <Label>Client</Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {filterClients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {masterLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New Activity
          </Button>
        )}
      </div>

      <Card>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500 text-sm">
            <Layers className="h-6 w-6 text-slate-300" />
            No activities yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Client</TableHead>
                <TableHead>Activity ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead title="Active members who can log time">Members</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a) => {
                const isOpen = expanded.has(a.id);
                const activeTasks = a.tasks.filter((t) => t.isActive).length;
                const activeMembers = a.members.filter((m) => m.isActive).length;
                return (
                  <Fragment key={a.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(a.id)}>
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        <span className="font-mono text-xs">{a.client.code}</span>
                        {a.client.description && <span className="ml-2 text-slate-400">{a.client.description}</span>}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {a.activityId}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-navy">{a.name}</TableCell>
                      <TableCell>
                        {a.contract ? (
                          <Badge variant={a.contract.status === "ACTIVE" ? "info" : "default"} className="font-mono">
                            {a.contract.code}
                          </Badge>
                        ) : (
                          <Badge variant="warning">No SOW</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{activeTasks}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {a.contract ? (
                          <span className={activeMembers === 0 ? "text-amber-700" : undefined}>{activeMembers}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canEdit ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={a.isActive}
                              disabled={togglingId === a.id}
                              onCheckedChange={(v) => setActive(a, v === true)}
                              aria-label="Active"
                            />
                            {togglingId === a.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                          </div>
                        ) : a.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && (
                                <>
                                  <DropdownMenuItem onSelect={() => setEditing(a)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Activity
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!a.contract || !contractById.get(a.contract.id)}
                                    onSelect={() => setEditingTasks(a)}
                                  >
                                    <ListChecks className="h-3.5 w-3.5 mr-2" /> Edit Tasks
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled={!a.contract} onSelect={() => openTab(a.id, "members")}>
                                    <Users className="h-3.5 w-3.5 mr-2" /> Manage Members
                                  </DropdownMenuItem>
                                </>
                              )}
                              {canDelete && (
                                <>
                                  {canEdit && <DropdownMenuSeparator />}
                                  <DropdownMenuItem className="text-red-600" onSelect={() => setDeleting(a)}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="bg-slate-50/50">
                          <ActivityDetails
                            activity={a}
                            contract={a.contract ? contractById.get(a.contract.id) : undefined}
                            users={users}
                            tab={tabs[a.id] ?? "tasks"}
                            onTabChange={(t) => setTabs((prev) => ({ ...prev, [a.id]: t }))}
                            canEdit={canEdit}
                            onEditTasks={() => setEditingTasks(a)}
                            onAddLegacyTask={() => setTaskDialog({ activity: a })}
                            onEditLegacyTask={(t) => setTaskDialog({ task: t, activity: a })}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {creating && (
        <CreateActivityDialog
          masters={masters}
          contracts={contracts}
          users={users}
          onClose={(changed) => {
            setCreating(false);
            if (changed) router.refresh();
          }}
        />
      )}

      {editing && (
        <EditActivityDialog
          activity={editing}
          cloudOptions={masters.CLOUD_ON_PREM}
          contracts={contracts}
          users={users}
          onClose={(changed) => {
            setEditing(null);
            if (changed) router.refresh();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete Activity"
          description={
            <>
              Delete <span className="font-mono">{deleting.activityId}</span>? If it has timesheet or sandbox
              entries it will be marked inactive instead. Otherwise it is removed together with its tasks.
            </>
          }
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const r = await fetch(`/api/activities?id=${deleting.id}`, { method: "DELETE" });
            const j = await readJson(r);
            if (!r.ok) {
              toast.error(j.error || "Delete failed");
              return;
            }
            toast.success(j.softDeleted ? "In use — marked inactive instead of deleted." : "Activity deleted");
            setDeleting(null);
            router.refresh();
          }}
        />
      )}

      {taskDialog && (
        <TaskDialog
          {...taskDialog}
          onClose={(changed) => {
            setTaskDialog(null);
            if (changed) router.refresh();
          }}
        />
      )}

      {editingTasks && editingTasks.contract && contractById.get(editingTasks.contract.id) && (
        <EditTasksDialog
          activity={editingTasks}
          contract={contractById.get(editingTasks.contract.id)!}
          onClose={(changed) => {
            setEditingTasks(null);
            if (changed) router.refresh();
          }}
        />
      )}
    </>
  );
}

function CreateActivityDialog({
  masters,
  contracts,
  users,
  onClose,
}: {
  masters: MastersByType;
  contracts: ContractLite[];
  users: UserOption[];
  onClose: (changed: boolean) => void;
}) {
  const [scope, setScope] = useState<ScopeValue>(emptyScope);
  const [name, setName] = useState("");
  const [ids, setIds] = useState<Record<(typeof ID_FIELDS)[number]["key"], string>>({
    clientId: "",
    typeId: "",
    productId: "",
    versionId: "",
    moduleId: "",
  });
  const [cloudOnPremId, setCloudOnPremId] = useState<string>(NONE);
  const [busy, setBusy] = useState(false);

  const active = (t: MasterType) => masters[t].filter((m) => m.isActive);
  const codeOf = (t: MasterType, id: string) =>
    masters[t].find((m) => String(m.id) === id)?.code.toUpperCase() ?? "?";

  // Mirrors buildActivityId (CLIENT.MODULE.TYPE.VERSION.SEQ); the real seq is
  // allocated server-side, so it's shown as a placeholder.
  const preview = [
    codeOf("CLIENT", ids.clientId),
    codeOf("MODULE", ids.moduleId),
    codeOf("TYPE", ids.typeId),
    codeOf("VERSION", ids.versionId),
    "####",
  ].join(".");

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    const missing = ID_FIELDS.filter((f) => !ids[f.key]).map((f) => f.label);
    if (missing.length) return toast.error(`Select ${missing.join(", ")}`);
    const problem = scopeProblem(scope);
    if (problem) return toast.error(problem);

    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        clientId: Number(ids.clientId),
        typeId: Number(ids.typeId),
        productId: Number(ids.productId),
        versionId: Number(ids.versionId),
        moduleId: Number(ids.moduleId),
        cloudOnPremId: cloudOnPremId === NONE ? null : Number(cloudOnPremId),
        ...scopePayload(scope),
      };
      const r = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await readJson(r);
      if (!r.ok) {
        toast.error(j.error || "Failed to create activity");
        return;
      }
      toast.success(`Activity ${j.data?.activityId ?? ""} created`);
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose(false)}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Activity</DialogTitle>
          <DialogDescription>
            The Activity ID is generated from the selected masters and cannot be changed later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SUMM Cloud Development"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ID_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                <Select
                  value={ids[f.key]}
                  onValueChange={(v) => {
                    setIds((prev) => ({ ...prev, [f.key]: v }));
                    // Contracts are per client; a new client invalidates the pick.
                    if (f.key === "clientId") setScope(emptyScope);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${f.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {active(f.type).length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-slate-400">No active {f.label.toLowerCase()} masters</div>
                    ) : (
                      active(f.type).map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {masterLabel(m)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="space-y-2">
              <Label>Cloud / On Prem (optional)</Label>
              <Select value={cloudOnPremId} onValueChange={setCloudOnPremId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {active("CLOUD_ON_PREM").map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {masterLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Activity ID preview</p>
            <p className="font-mono text-sm text-navy">{preview}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">#### is assigned automatically on save.</p>
          </div>
          <ScopeEditor clientId={ids.clientId} contracts={contracts} users={users} value={scope} onChange={setScope} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditActivityDialog({
  activity,
  cloudOptions,
  contracts,
  users,
  onClose,
}: {
  activity: Activity;
  cloudOptions: MasterOption[];
  contracts: ContractLite[];
  users: UserOption[];
  onClose: (changed: boolean) => void;
}) {
  const initialScope = useMemo(() => scopeOf(activity), [activity]);
  const [scope, setScope] = useState<ScopeValue>(initialScope);
  const scopeChanged = JSON.stringify(scope) !== JSON.stringify(initialScope);
  const [name, setName] = useState(activity.name);
  const [cloudOnPremId, setCloudOnPremId] = useState<string>(
    activity.cloudOnPrem ? String(activity.cloudOnPrem.id) : NONE
  );
  const [isActive, setIsActive] = useState(activity.isActive);
  const [busy, setBusy] = useState(false);

  // Active options, plus the current value even if it has since been deactivated.
  const options = cloudOptions.filter((m) => m.isActive || m.id === activity.cloudOnPrem?.id);

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    // A legacy Activity may be saved without a contract; once one is chosen,
    // the whole scope must be valid.
    const problem = scope.contractId || activity.contract ? scopeProblem(scope) : null;
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const r = await fetch("/api/activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activity.id,
          name: name.trim(),
          cloudOnPremId: cloudOnPremId === NONE ? null : Number(cloudOnPremId),
          isActive,
          ...(scopeChanged ? scopePayload(scope) : {}),
        }),
      });
      const j = await readJson(r);
      if (!r.ok) {
        toast.error(j.error || "Update failed");
        return;
      }
      const sc = j.scope as null | { deactivated: string[] };
      toast.success(
        sc?.deactivated.length
          ? `Activity updated. Deactivated (has logged time): ${sc.deactivated.join(", ")}`
          : "Activity updated"
      );
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  const fixed: { label: string; m: MasterBrief }[] = [
    { label: "Client", m: activity.client },
    { label: "Type", m: activity.type },
    { label: "Product", m: activity.product },
    { label: "Version", m: activity.version },
    { label: "Module", m: activity.module },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose(false)}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{activity.activityId}</span> — the ID-forming masters below are fixed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fixed.map(({ label, m }) => (
              <div key={label} className="space-y-2">
                <Label>{label}</Label>
                <Input value={masterLabel(m)} disabled readOnly className="font-mono text-xs" />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Cloud / On Prem</Label>
              <Select value={cloudOnPremId} onValueChange={setCloudOnPremId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {options.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {masterLabel(m)}
                      {!m.isActive && " (inactive)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!activity.contract && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This Activity predates contracts. Attaching a contract links its existing tasks to SOW tasks with the
              same code. Tasks with no match are deactivated if they have logged time, otherwise removed.
            </p>
          )}
          <ScopeEditor
            clientId={String(activity.client.id)}
            contracts={contracts}
            users={users}
            value={scope}
            onChange={setScope}
          />
          <div className="flex items-center gap-2">
            <Checkbox id="activity-active" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
            <Label htmlFor="activity-active" className="normal-case tracking-normal font-medium text-slate-700">
              Active
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({
  task,
  activity,
  onClose,
}: {
  task?: Task;
  activity: Activity;
  onClose: (changed: boolean) => void;
}) {
  const [taskId, setTaskId] = useState(task?.taskId ?? "");
  const [taskName, setTaskName] = useState(task?.taskName ?? "");
  const [poRef, setPoRef] = useState(task?.poRef ?? "");
  const [isActive, setIsActive] = useState(task?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!taskId.trim() || !taskName.trim()) return toast.error("Task ID and name required");
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        taskId: taskId.trim(),
        taskName: taskName.trim(),
        poRef: poRef.trim() || null,
        activityId: activity.id,
        isActive,
      };
      if (task) body.id = task.id;
      const r = await fetch("/api/tasks", {
        method: task ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await readJson(r);
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return;
      }
      toast.success(task ? "Task updated" : "Task added");
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Add Task"}</DialogTitle>
          <DialogDescription>
            Under <span className="font-mono">{activity.activityId}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-1">
              <Label>Task ID</Label>
              <Input
                placeholder="SUP"
                value={taskId}
                disabled={task?.contractTaskId != null}
                onChange={(e) => setTaskId(e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Task name</Label>
              <Input placeholder="Beeline task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
            </div>
          </div>
          {task?.contractTaskId == null && (
            <div className="space-y-2">
              <Label>PO Reference (optional)</Label>
              <Input placeholder="STC/SOW/08OCT2025/01" value={poRef} onChange={(e) => setPoRef(e.target.value)} />
            </div>
          )}
          {task && (
            <div className="flex items-center gap-2">
              <Checkbox id="task-active" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
              <Label htmlFor="task-active" className="normal-case tracking-normal font-medium text-slate-700">
                Active
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {task ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
