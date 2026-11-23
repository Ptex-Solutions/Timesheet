"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Loader2, Pencil, PlusCircle, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ContractLite, UserOption } from "./scope-editor";
import { readJson, type ActivityMemberRow, type ActivityRow, type ActivityTask } from "./types";

export type DetailTab = "tasks" | "members";

// Accordion body: switch between the Activity's tasks and its members, with
// quick active/inactive toggles and add/remove.
export function ActivityDetails({
  activity,
  contract,
  users,
  tab,
  onTabChange,
  canEdit,
  onEditTasks,
  onAddLegacyTask,
  onEditLegacyTask,
}: {
  activity: ActivityRow;
  contract: ContractLite | undefined;
  users: UserOption[];
  tab: DetailTab;
  onTabChange: (t: DetailTab) => void;
  canEdit: boolean;
  onEditTasks: () => void;
  onAddLegacyTask: () => void;
  onEditLegacyTask: (t: ActivityTask) => void;
}) {
  const activeMembers = activity.members.filter((m) => m.isActive).length;
  const activeTasks = activity.tasks.filter((t) => t.isActive).length;

  return (
    <div className="py-2 px-2 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Type <span className="font-mono text-slate-700">{activity.type.code}</span></span>
        <span>· Product <span className="font-mono text-slate-700">{activity.product.code}</span></span>
        <span>· Version <span className="font-mono text-slate-700">{activity.version.code}</span></span>
        <span>· Module <span className="font-mono text-slate-700">{activity.module.code}</span></span>
        {activity.cloudOnPrem && (
          <span>· <span className="font-mono text-slate-700">{activity.cloudOnPrem.code}</span></span>
        )}
        {activity.contract && (
          <span>· SOW / PO <span className="font-mono text-slate-700">{activity.contract.code}</span></span>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as DetailTab)}>
        <TabsList>
          <TabsTrigger value="tasks">
            Tasks ({activeTasks}/{activity.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="members">
            Members ({activeMembers}/{activity.members.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <TasksTab
            activity={activity}
            canEdit={canEdit}
            onEditTasks={onEditTasks}
            onAddLegacyTask={onAddLegacyTask}
            onEditLegacyTask={onEditLegacyTask}
          />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab activity={activity} contract={contract} users={users} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TasksTab({
  activity,
  canEdit,
  onEditTasks,
  onAddLegacyTask,
  onEditLegacyTask,
}: {
  activity: ActivityRow;
  canEdit: boolean;
  onEditTasks: () => void;
  onAddLegacyTask: () => void;
  onEditLegacyTask: (t: ActivityTask) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function setActive(t: ActivityTask, isActive: boolean) {
    setBusy(t.id);
    try {
      const r = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, isActive }),
      });
      const j = await readJson(r);
      if (!r.ok) return void toast.error(j.error || "Update failed");
      toast.success(`${t.taskId} ${isActive ? "activated" : "deactivated"}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <div className="flex justify-end">
          {activity.contract ? (
            <Button size="sm" variant="outline" onClick={onEditTasks}>
              <ListChecks className="h-3.5 w-3.5" /> Edit Tasks
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onAddLegacyTask}>
              <PlusCircle className="h-3.5 w-3.5" /> Add task
            </Button>
          )}
        </div>
      )}
      {activity.tasks.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No tasks under this activity yet.</p>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>Task Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.tasks.map((t) => (
                <TableRow key={t.id} className={t.isActive ? undefined : "opacity-60"}>
                  <TableCell>
                    <Badge variant="brand" className="font-mono">{t.taskId}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{t.taskName}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {t.contractTaskId !== null ? (
                      <Badge variant="info">SOW</Badge>
                    ) : (
                      <span className="font-mono">{t.poRef ? `Legacy · ${t.poRef}` : "Legacy"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={t.isActive}
                          disabled={busy === t.id}
                          onCheckedChange={(v) => setActive(t, v === true)}
                          aria-label={`${t.taskId} active`}
                        />
                        {busy === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                      </div>
                    ) : t.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* SOW tasks take code and name from the Tasks master; only legacy ones are editable. */}
                    {canEdit && t.contractTaskId === null && (
                      <Button size="icon" variant="ghost" onClick={() => onEditLegacyTask(t)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function MembersTab({
  activity,
  contract,
  users,
  canEdit,
}: {
  activity: ActivityRow;
  contract: ContractLite | undefined;
  users: UserOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState("");
  const [removing, setRemoving] = useState<ActivityMemberRow | null>(null);

  if (!activity.contract) {
    return (
      <p className="text-sm text-slate-500 text-center py-4">
        Attach a Contract (Edit Activity) before adding members.
      </p>
    );
  }
  const roles = contract?.roles ?? [];
  const url = `/api/activities/${activity.id}/members`;

  async function call(key: string, init: RequestInit, ok: string, query = "") {
    setBusy(key);
    try {
      const r = await fetch(url + query, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      const j = await readJson(r);
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return false;
      }
      toast.success(ok);
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const update = (m: ActivityMemberRow, patch: { isActive?: boolean; resourceTypeId?: number }, msg: string) =>
    call(`put:${m.userId}`, { method: "PUT", body: JSON.stringify({ userId: m.userId, ...patch }) }, msg);

  async function add() {
    if (!newUser || !newRole) return toast.error("Pick a person and a role");
    const ok = await call(
      "post",
      { method: "POST", body: JSON.stringify({ userId: Number(newUser), resourceTypeId: Number(newRole) }) },
      "Member added"
    );
    if (ok) {
      setNewUser("");
      setNewRole("");
    }
  }

  const available = users.filter((u) => !activity.members.some((m) => m.userId === u.id));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Only active members can log time. Deactivating or removing someone keeps their existing entries.
      </p>
      {activity.members.length === 0 ? (
        <p className="text-sm text-amber-700 text-center py-3">No members yet, so nobody can log time.</p>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Billing role</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.members.map((m) => (
                <TableRow key={m.userId} className={m.isActive ? undefined : "opacity-60"}>
                  <TableCell className="text-sm">
                    {m.user.name} <span className="text-xs text-slate-400 font-mono">{m.user.employeeCode}</span>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select
                        value={String(m.resourceTypeId)}
                        disabled={busy !== null}
                        onValueChange={(v) => update(m, { resourceTypeId: Number(v) }, "Role updated")}
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.code}
                              {r.description ? ` — ${r.description}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{m.resourceType.code}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={m.isActive}
                          disabled={busy !== null}
                          onCheckedChange={(v) =>
                            update(m, { isActive: v === true }, v === true ? "Member activated" : "Member deactivated")
                          }
                          aria-label={`${m.user.name} active`}
                        />
                        {busy === `put:${m.userId}` && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                      </div>
                    ) : m.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        disabled={busy !== null}
                        onClick={() => setRemoving(m)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Select value={newUser || undefined} onValueChange={setNewUser}>
            <SelectTrigger className="h-8 w-60">
              <SelectValue placeholder="Person" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-slate-400">Everyone is already a member</div>
              ) : (
                available.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name} ({u.employeeCode})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={newRole || undefined} onValueChange={setNewRole}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.code}
                  {r.description ? ` — ${r.description}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={busy !== null}>
            {busy === "post" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Add member
          </Button>
        </div>
      )}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              Remove {removing?.user.name} from {activity.activityId}? Their existing entries are kept. To pause them
              without removing, untick Active instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={async () => {
                const m = removing!;
                const ok = await call(`delete:${m.userId}`, { method: "DELETE" }, "Member removed", `?userId=${m.userId}`);
                if (ok) setRemoving(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// "Edit Tasks": choose which SOW tasks the Activity delivers, and whether each
// selected one is active. A task with logged time can't be unselected (the
// server refuses); mark it inactive instead.
export function EditTasksDialog({
  activity,
  contract,
  onClose,
}: {
  activity: ActivityRow;
  contract: ContractLite;
  onClose: (changed: boolean) => void;
}) {
  const byLine = new Map(activity.tasks.filter((t) => t.contractTaskId !== null).map((t) => [t.contractTaskId!, t]));
  const [state, setState] = useState<Record<number, { selected: boolean; active: boolean }>>(() =>
    Object.fromEntries(
      contract.tasks.map((ct) => {
        const t = byLine.get(ct.id);
        return [ct.id, { selected: !!t, active: t ? t.isActive : true }];
      })
    )
  );
  const [busy, setBusy] = useState(false);
  const selected = contract.tasks.filter((ct) => state[ct.id]?.selected);

  async function save() {
    if (selected.length === 0) return toast.error("Select at least one task");
    setBusy(true);
    try {
      const r = await fetch("/api/activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activity.id,
          contractId: contract.id,
          contractTaskIds: selected.map((ct) => ct.id),
          taskActive: Object.fromEntries(selected.map((ct) => [ct.id, state[ct.id].active])),
        }),
      });
      const j = await readJson(r);
      if (!r.ok) return void toast.error(j.error || "Update failed");
      toast.success("Tasks updated");
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  const set = (id: number, patch: Partial<{ selected: boolean; active: boolean }>) =>
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose(false)}>
      <DialogContent className="w-[95vw] max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Tasks</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{activity.activityId}</span> · tasks from {contract.code}. Unselecting removes a
            task from this Activity; a task with logged time can only be made inactive.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Selected</TableHead>
                <TableHead>Task</TableHead>
                <TableHead className="w-24">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.tasks.map((ct) => {
                const s = state[ct.id];
                return (
                  <TableRow key={ct.id} className={s.selected ? undefined : "opacity-60"}>
                    <TableCell>
                      <Checkbox checked={s.selected} onCheckedChange={(v) => set(ct.id, { selected: v === true })} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="brand" className="font-mono mr-2">
                        {ct.taskMaster.code}
                      </Badge>
                      {ct.taskMaster.description}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={s.selected && s.active}
                        disabled={!s.selected}
                        onCheckedChange={(v) => set(ct.id, { active: v === true })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
