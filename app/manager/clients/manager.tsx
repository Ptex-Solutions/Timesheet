"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, ChevronRight, Loader2, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Task = { id: number; taskId: string; taskName: string; poRef: string | null };
type Project = { id: number; activityId: string; description: string; clientId: number; tasks: Task[] };
type Client = { id: number; clientCode: string; clientName: string; projects: Project[] };

export function ClientsManager({
  initial,
  canEdit,
  canDelete,
}: {
  initial: Client[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<number>>(new Set(initial.slice(0, 1).map((c) => c.id)));
  const [clientDialog, setClientDialog] = useState<Client | "new" | null>(null);
  const [projectDialog, setProjectDialog] = useState<{ project?: Project; clientId: number } | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ task?: Task; projectId: number } | null>(null);

  function toggle(id: number) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }

  async function delClient(id: number) {
    if (!confirm("Deactivate this client?")) return;
    const r = await fetch(`/api/clients?id=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("Removed"); router.refresh(); }
    else toast.error("Failed");
  }
  async function delProject(id: number) {
    if (!confirm("Deactivate this project?")) return;
    const r = await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("Removed"); router.refresh(); }
    else toast.error("Failed");
  }
  async function delTask(id: number) {
    if (!confirm("Deactivate this task?")) return;
    const r = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("Removed"); router.refresh(); }
    else toast.error("Failed");
  }

  return (
    <>
      {canEdit && (
        <div className="flex justify-end mb-3">
          <Button onClick={() => setClientDialog("new")}>
            <PlusCircle className="h-4 w-4" /> Add client
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {initial.length === 0 && (
          <Card><CardContent className="py-12 text-center text-slate-400">No clients yet.</CardContent></Card>
        )}
        {initial.map((c) => {
          const isOpen = expanded.has(c.id);
          return (
            <Card key={c.id}>
              <CardHeader className="cursor-pointer" onClick={() => toggle(c.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand flex items-center justify-center">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{c.clientCode}</span>
                        {c.clientName}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">{c.projects.length} active projects</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => setClientDialog(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => delClient(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent>
                  {canEdit && (
                    <div className="flex justify-end mb-3">
                      <Button size="sm" variant="outline" onClick={() => setProjectDialog({ clientId: c.id })}>
                        <PlusCircle className="h-3.5 w-3.5" /> Add project
                      </Button>
                    </div>
                  )}

                  {c.projects.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">No projects under this client yet.</p>
                  )}

                  <div className="space-y-3">
                    {c.projects.map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50/30 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-xs text-slate-600">{p.activityId}</p>
                            <p className="text-sm font-medium text-navy">{p.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => setTaskDialog({ projectId: p.id })}>
                                  <PlusCircle className="h-3.5 w-3.5" /> Task
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setProjectDialog({ project: p, clientId: c.id })}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {canDelete && (
                              <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => delProject(p.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {p.tasks.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {p.tasks.map((t) => (
                              <div key={t.id} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm border border-slate-100">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Badge variant="brand" className="font-mono">{t.taskId}</Badge>
                                  <span className="truncate">{t.taskName}</span>
                                  {t.poRef && <span className="text-xs text-slate-400 font-mono ml-2 truncate">{t.poRef}</span>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {canEdit && (
                                    <Button size="icon" variant="ghost" onClick={() => setTaskDialog({ task: t, projectId: p.id })}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => delTask(t.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {clientDialog && (
        <ClientDialog
          client={clientDialog === "new" ? undefined : clientDialog}
          onClose={() => { setClientDialog(null); router.refresh(); }}
        />
      )}
      {projectDialog && (
        <ProjectDialog
          {...projectDialog}
          clients={initial.map((c) => ({ id: c.id, clientCode: c.clientCode, clientName: c.clientName }))}
          onClose={() => { setProjectDialog(null); router.refresh(); }}
        />
      )}
      {taskDialog && (
        <TaskDialog {...taskDialog} onClose={() => { setTaskDialog(null); router.refresh(); }} />
      )}
    </>
  );
}

function ClientDialog({ client, onClose }: { client?: Client; onClose: () => void }) {
  const [code, setCode] = useState(client?.clientCode ?? "");
  const [name, setName] = useState(client?.clientName ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!code.trim() || !name.trim()) return toast.error("All fields required");
    setBusy(true);
    try {
      const body: any = { clientCode: code, clientName: name };
      if (client) body.id = client.id;
      const r = await fetch("/api/clients", {
        method: client ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const j = await r.json(); toast.error(j.error || "Failed"); return; }
      toast.success(client ? "Updated" : "Client added");
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "Add Client"}</DialogTitle>
          <DialogDescription>The Client Code shows on every timesheet row.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client code</Label>
            <Input placeholder="e.g. STC" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label>Client name</Label>
            <Input placeholder="e.g. STC Group" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{client ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({
  project,
  clientId,
  clients,
  onClose,
}: {
  project?: Project;
  clientId: number;
  clients: Array<{ id: number; clientCode: string; clientName: string }>;
  onClose: () => void;
}) {
  const [activityId, setActivityId] = useState(project?.activityId ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [linkedClientId, setLinkedClientId] = useState<number>(project?.clientId ?? clientId);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!activityId.trim() || !description.trim()) return toast.error("All fields required");
    setBusy(true);
    try {
      const body: any = { activityId, description, clientId: linkedClientId };
      if (project) body.id = project.id;
      const r = await fetch("/api/projects", {
        method: project ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const j = await r.json(); toast.error(j.error || "Failed"); return; }
      toast.success(project ? "Updated" : "Project added");
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "Add Project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Activity ID</Label>
            <Input placeholder="e.g. STC.ALL.LNG.2.0.4375" value={activityId} onChange={(e) => setActivityId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input placeholder="e.g. Timeline-Support-Technical" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={linkedClientId.toString()} onValueChange={(v) => setLinkedClientId(parseInt(v, 10))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    <span className="font-mono text-xs mr-2">{c.clientCode}</span>{c.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{project ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ task, projectId, onClose }: { task?: Task; projectId: number; onClose: () => void }) {
  const [taskId, setTaskId] = useState(task?.taskId ?? "");
  const [taskName, setTaskName] = useState(task?.taskName ?? "");
  const [poRef, setPoRef] = useState(task?.poRef ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!taskId.trim() || !taskName.trim()) return toast.error("Task ID and name required");
    setBusy(true);
    try {
      const body: any = { taskId, taskName, projectId, poRef: poRef || null };
      if (task) body.id = task.id;
      const r = await fetch("/api/tasks", {
        method: task ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const j = await r.json(); toast.error(j.error || "Failed"); return; }
      toast.success(task ? "Updated" : "Task added");
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-1">
              <Label>Task ID</Label>
              <Input placeholder="SUP" value={taskId} onChange={(e) => setTaskId(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Task name</Label>
              <Input placeholder="Beeline task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>PO Reference (optional)</Label>
            <Input placeholder="STC/SOW/08OCT2025/01" value={poRef} onChange={(e) => setPoRef(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{task ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
