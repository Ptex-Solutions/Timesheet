"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Pencil,
  PlusCircle,
  Trash2,
  Undo2,
  Loader2,
  Save,
  ShieldAlert,
  GitCompare,
  X,
  CheckCircle2,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";

type User = { id: number; name: string; employeeCode: string };
type Client = {
  id: number;
  clientCode: string;
  clientName: string;
  projects: Array<{
    id: number;
    activityId: string;
    description: string;
    tasks: Array<{ id: number; taskId: string; taskName: string; poRef: string | null }>;
  }>;
};
type Entry = any;

const TYPES = ["Internal", "Implementation", "R&D", "Yoga", "Support", "Meeting", "Training"];

export function SandboxEditor({
  label,
  users,
  clients,
  canEdit,
  canDelete,
  canFinalize,
}: {
  label: string;
  users: User[];
  clients: Client[];
  canEdit: boolean;
  canDelete: boolean;
  canFinalize: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [adding, setAdding] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sandbox", label],
    queryFn: async () => {
      const r = await fetch(`/api/sandbox/${encodeURIComponent(label)}`);
      const j = await r.json();
      return j.data as Entry[];
    },
  });

  const entries = (data ?? []).filter((e) => !e.isDeleted);
  const removed = (data ?? []).filter((e) => e.isDeleted);
  const added = entries.filter((e) => e.isAdded);
  const modified = entries.filter((e) => e.isModified && !e.isAdded);

  const totals = useMemo(() => {
    const total = entries.reduce((s, r) => s + Number(r.hours), 0);
    return { total, count: entries.length };
  }, [entries]);

  async function softDelete(id: number) {
    if (!confirm("Soft-delete this row from the sandbox? Original timesheet stays untouched.")) return;
    const r = await fetch(`/api/sandbox?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Row removed from sandbox");
      qc.invalidateQueries({ queryKey: ["sandbox", label] });
    } else {
      toast.error("Failed");
    }
  }

  async function purgeAll() {
    if (!confirm(`Delete the ENTIRE sandbox "${label}"? Original timesheets stay intact.`)) return;
    const r = await fetch(`/api/sandbox?label=${encodeURIComponent(label)}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Sandbox deleted");
      router.push("/manager/sandbox");
    } else toast.error("Failed");
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Active rows" value={String(entries.length)} />
        <Stat label="Total hours" value={totals.total.toFixed(2)} accent />
        <Stat label="Added" value={String(added.length)} color="emerald" />
        <Stat label="Modified" value={String(modified.length)} color="amber" />
      </div>

      <Tabs defaultValue="rows">
        <div className="flex items-center justify-between mb-2">
          <TabsList>
            <TabsTrigger value="rows">Rows ({entries.length})</TabsTrigger>
            <TabsTrigger value="diff">
              <GitCompare className="h-3.5 w-3.5 mr-1" /> Diff
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <PlusCircle className="h-4 w-4" /> Add row
              </Button>
            )}
            {canFinalize && (
              <Button variant="success" onClick={() => setShowFinalize(true)}>
                <Save className="h-4 w-4" /> Finalize as MIS
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={purgeAll}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="rows">
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : (
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Client</th>
                    <th>Activity</th>
                    <th>Task</th>
                    <th>Description</th>
                    <th className="text-right">Hours</th>
                    <th>Type</th>
                    <th>Tag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-12 text-slate-400">No rows in this sandbox.</td></tr>
                  )}
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className={
                        e.isAdded
                          ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                          : e.isModified
                          ? "bg-amber-50/40 hover:bg-amber-50/60"
                          : ""
                      }
                    >
                      <td>{formatDate(e.date)}</td>
                      <td>
                        <p className="font-medium">{e.user?.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{e.user?.employeeCode}</p>
                      </td>
                      <td><span className="font-mono text-xs">{e.client?.clientCode}</span></td>
                      <td className="font-mono text-xs">{e.project?.activityId}</td>
                      <td>
                        <p className="font-mono text-xs">{e.task?.taskId}</p>
                      </td>
                      <td className="max-w-xs truncate">{e.description}</td>
                      <td className="text-right font-semibold tabular-nums">{Number(e.hours).toFixed(2)}</td>
                      <td className="text-xs">{e.type}</td>
                      <td>
                        {e.isAdded ? <Badge variant="success">Added</Badge>
                          : e.isModified ? <Badge variant="warning">Modified</Badge>
                          : <Badge>Original</Badge>}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => softDelete(e.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="diff">
          <Card>
            <CardHeader>
              <CardTitle>Sandbox vs Original</CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-1 mr-3"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Added</span>
                <span className="inline-flex items-center gap-1 mr-3"><span className="h-2 w-2 rounded-full bg-amber-500" /> Modified</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Removed</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DiffSection title="Added rows" tone="emerald" rows={added} />
              <DiffSection title="Modified rows" tone="amber" rows={modified} />
              <DiffSection title="Removed rows (soft-deleted)" tone="red" rows={removed} />
              {added.length === 0 && modified.length === 0 && removed.length === 0 && (
                <div className="text-sm text-slate-400 text-center py-8">
                  Sandbox matches the original snapshot. Make some edits to see the diff.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {(editing || adding) && (
        <EntryDialog
          label={label}
          entry={editing ?? undefined}
          mode={adding ? "create" : "edit"}
          users={users}
          clients={clients}
          onClose={() => {
            setEditing(null);
            setAdding(false);
            qc.invalidateQueries({ queryKey: ["sandbox", label] });
          }}
        />
      )}

      {showFinalize && (
        <FinalizeDialog
          label={label}
          onClose={() => setShowFinalize(false)}
        />
      )}
    </>
  );
}

function Stat({ label, value, accent, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${
          accent ? "text-brand" : color ? colors[color] : "text-navy"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DiffSection({ title, tone, rows }: { title: string; tone: "emerald" | "amber" | "red"; rows: Entry[] }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50/60",
    amber: "border-amber-200 bg-amber-50/60",
    red: "border-red-200 bg-red-50/60",
  };
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{title} <span className="text-slate-400">({rows.length})</span></h4>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className={`rounded-lg border p-3 ${tones[tone]}`}>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{formatDate(r.date)} · <span className="font-mono">{r.client?.clientCode}</span> · <span className="font-mono">{r.project?.activityId}</span></span>
              <span className="font-semibold tabular-nums">{Number(r.hours).toFixed(2)}h</span>
            </div>
            <p className="text-sm text-slate-700 mt-1 truncate">{r.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryDialog({
  label,
  entry,
  mode,
  users,
  clients,
  onClose,
}: {
  label: string;
  entry?: Entry;
  mode: "create" | "edit";
  users: User[];
  clients: Client[];
  onClose: () => void;
}) {
  const [date, setDate] = useState<string>(entry?.date?.slice?.(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [userId, setUserId] = useState<number | null>(entry?.userId ?? null);
  const [clientId, setClientId] = useState<number | null>(entry?.clientId ?? null);
  const [projectId, setProjectId] = useState<number | null>(entry?.projectId ?? null);
  const [taskId, setTaskId] = useState<number | null>(entry?.taskId ?? null);
  const [hours, setHours] = useState<number>(Number(entry?.hours ?? 0));
  const [description, setDescription] = useState<string>(entry?.description ?? "");
  const [type, setType] = useState<string>(entry?.type ?? "Implementation");
  const [managerNote, setManagerNote] = useState<string>(entry?.managerNote ?? "");
  const [busy, setBusy] = useState(false);

  const projects = clients.find((c) => c.id === clientId)?.projects ?? [];
  const tasks = projects.find((p) => p.id === projectId)?.tasks ?? [];

  async function save() {
    if (!userId || !clientId || !projectId || !taskId || hours <= 0 || !description.trim()) {
      toast.error("Fill all fields");
      return;
    }
    setBusy(true);
    try {
      const body: any = {
        sandboxLabel: label,
        userId, clientId, projectId, taskId,
        date, hours, description, type, managerNote,
      };
      if (mode === "edit") body.id = entry!.id;

      const r = await fetch("/api/sandbox", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return;
      }
      toast.success(mode === "create" ? "Row added to sandbox" : "Row updated");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Sandbox Row" : "Edit Sandbox Row"}</DialogTitle>
          <DialogDescription>
            Sandbox-only — original timesheets are not modified.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Hours</Label>
            <Input type="number" step="0.25" min="0" max="24" value={hours} onChange={(e) => setHours(parseFloat(e.target.value) || 0)} />
          </div>

          <div className="space-y-2">
            <Label>
              <ArrowRightLeft className="inline h-3 w-3 mr-1" /> Employee
            </Label>
            <Select value={userId?.toString() ?? ""} onValueChange={(v) => setUserId(parseInt(v, 10))}>
              <SelectTrigger><SelectValue placeholder="Pick employee" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name} <span className="font-mono text-xs ml-2 text-slate-500">{u.employeeCode}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId?.toString() ?? ""} onValueChange={(v) => { setClientId(parseInt(v, 10)); setProjectId(null); setTaskId(null); }}>
              <SelectTrigger><SelectValue placeholder="Pick client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    <span className="font-mono text-xs mr-2">{c.clientCode}</span>{c.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Activity</Label>
            <Select value={projectId?.toString() ?? ""} onValueChange={(v) => { setProjectId(parseInt(v, 10)); setTaskId(null); }} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder="Pick activity" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    <span className="font-mono text-xs mr-2">{p.activityId}</span>{p.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Task</Label>
            <Select value={taskId?.toString() ?? ""} onValueChange={(v) => setTaskId(parseInt(v, 10))} disabled={!projectId}>
              <SelectTrigger><SelectValue placeholder="Pick task" /></SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    <span className="font-mono text-xs mr-2">{t.taskId}</span>{t.taskName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Manager note (private)</Label>
            <Textarea rows={2} value={managerNote} onChange={(e) => setManagerNote(e.target.value)} placeholder="Optional context for finalization..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Add row" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeDialog({ label, onClose }: { label: string; onClose: () => void }) {
  const [title, setTitle] = useState(`MIS — ${label}`);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function finalize() {
    if (!from || !to) return toast.error("Pick the period");
    setBusy(true);
    try {
      const r = await fetch("/api/mis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "sandbox",
          sandboxLabel: label,
          dateFrom: from,
          dateTo: to,
          finalize: true,
          title,
        }),
      });
      const j = await r.json();
      if (!r.ok) return toast.error(j.error || "Failed");
      toast.success("MIS report finalized");
      router.push(`/manager/mis/${j.data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><CheckCircle2 className="inline h-5 w-5 text-emerald-600 mr-1" /> Finalize as MIS</DialogTitle>
          <DialogDescription>
            Snapshots this sandbox into a permanent MIS report. The sandbox stays editable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Report title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Period from</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Period to</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 flex gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <p>Already-finalized periods may be overwritten. Verify the title and dates carefully.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" onClick={finalize} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Finalize MIS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
