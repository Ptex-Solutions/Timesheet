"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, ListTree } from "lucide-react";
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

type MasterType = "TYPE" | "CLIENT" | "PRODUCT" | "VERSION" | "MODULE" | "CLOUD_ON_PREM";

const MASTER_TYPE_OPTIONS: { value: MasterType; label: string }[] = [
  { value: "TYPE", label: "Type" },
  { value: "CLIENT", label: "Client" },
  { value: "PRODUCT", label: "Product" },
  { value: "VERSION", label: "Version" },
  { value: "MODULE", label: "Module" },
  { value: "CLOUD_ON_PREM", label: "Cloud / On Prem" },
];

const TYPE_LABEL: Record<MasterType, string> = Object.fromEntries(
  MASTER_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<MasterType, string>;

type Master = {
  id: number;
  type: MasterType;
  code: string;
  description: string | null;
  isActive: boolean;
};

export function MastersPanel({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const [type, setType] = useState<MasterType>("TYPE");
  const [rows, setRows] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Master | null>(null);
  const [deleting, setDeleting] = useState<Master | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (t: MasterType) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/masters?type=${t}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed to load");
        setRows([]);
        return;
      }
      setRows(j.data ?? []);
    } catch {
      toast.error("Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(type);
  }, [type, load]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const r = await fetch(`/api/masters?id=${deleting.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || "Delete failed");
        return;
      }
      if (j.softDeleted) {
        toast.success("In use — marked inactive instead of deleted.");
      } else {
        toast.success("Deleted");
      }
      setDeleting(null);
      load(type);
    } catch {
      toast.error("Delete failed — could not reach the server");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="w-full sm:w-64 space-y-2">
          <Label>Master type</Label>
          <Select value={type} onValueChange={(v) => setType(v as MasterType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MASTER_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add {TYPE_LABEL[type]}
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500 text-sm">
            <ListTree className="h-6 w-6 text-slate-300" />
            No {TYPE_LABEL[type].toLowerCase()} masters yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs font-medium text-navy">{m.code}</TableCell>
                  <TableCell className="text-sm text-slate-600">{m.description || "—"}</TableCell>
                  <TableCell>
                    {m.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Button size="icon" variant="ghost" onClick={() => setEditing(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setDeleting(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {(creating || editing) && (
        <MasterDialog
          type={type}
          master={editing ?? undefined}
          mode={creating ? "create" : "edit"}
          onClose={(changed) => {
            setCreating(false);
            setEditing(null);
            if (changed) load(type);
          }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={(o) => !o && !deleteBusy && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {TYPE_LABEL[type]}</DialogTitle>
              <DialogDescription>
                Delete <span className="font-mono">{deleting.code}</span>? If it&apos;s referenced by an
                Activity or timesheet, it will be marked inactive instead of removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy}>
                {deleteBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function MasterDialog({
  type,
  master,
  mode,
  onClose,
}: {
  type: MasterType;
  master?: Master;
  mode: "create" | "edit";
  onClose: (changed: boolean) => void;
}) {
  const [code, setCode] = useState(master?.code ?? "");
  const [description, setDescription] = useState(master?.description ?? "");
  const [isActive, setIsActive] = useState(master?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!code.trim()) {
      toast.error("Code is required");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> =
        mode === "create"
          ? { type, code: code.trim(), description: description.trim() || null, isActive }
          : { id: master!.id, code: code.trim(), description: description.trim() || null, isActive };

      const r = await fetch("/api/masters", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || `Save failed (HTTP ${r.status})`);
        return;
      }
      toast.success(mode === "create" ? `${TYPE_LABEL[type]} added` : "Updated");
      onClose(true);
    } catch {
      toast.error("Save failed — could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? `Add ${TYPE_LABEL[type]}` : `Edit ${TYPE_LABEL[type]}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Create a new ${TYPE_LABEL[type].toLowerCase()} master.`
              : "If this master is already in use by an Activity or timesheet, its code can't be changed — the server will reject the save."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. STC" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="master-active" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
            <Label htmlFor="master-active" className="normal-case tracking-normal font-medium text-slate-700">
              Active
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
