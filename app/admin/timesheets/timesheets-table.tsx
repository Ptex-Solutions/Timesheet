"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, MessageSquareWarning, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

export type ManagerTimesheetRow = {
  id: number;
  date: string;
  userName: string;
  employeeCode: string;
  clientCode: string;
  activityCode: string;
  taskCode: string;
  taskName: string;
  description: string;
  hours: number;
  type: string;
  status: string;
  queryStatus: "OPEN" | "RESOLVED" | null;
  commentCount: number;
};

export function ManagerTimesheetsTable({ rows, canApprove }: { rows: ManagerTimesheetRow[]; canApprove: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [rejecting, setRejecting] = useState<number[] | null>(null);
  const [reason, setReason] = useState("");

  const submittedIds = useMemo(() => rows.filter((r) => r.status === "SUBMITTED").map((r) => r.id), [rows]);
  const selectedIds = submittedIds.filter((id) => selected.has(id));
  const allSelected = submittedIds.length > 0 && selectedIds.length === submittedIds.length;
  const openQueries = rows.filter((r) => r.queryStatus === "OPEN").length;

  function toggle(id: number, on: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function decide(ids: number[], status: "APPROVED" | "REJECTED", rejectionNote?: string) {
    if (!ids.length) return false;
    setBusyIds((b) => new Set([...b, ...ids]));
    try {
      const r = await fetch("/api/timesheets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status, rejectionNote }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || `Failed (HTTP ${r.status})`);
        return false;
      }
      const { updated, skipped } = j.data as { updated: number; skipped: number };
      const verb = status === "APPROVED" ? "approved" : "rejected";
      if (updated) toast.success(`${updated} ${updated === 1 ? "entry" : "entries"} ${verb}`);
      if (skipped) toast.warning(`${skipped} skipped — no longer submitted`);
      setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
      router.refresh();
      return true;
    } catch {
      toast.error("Could not reach the server");
      return false;
    } finally {
      setBusyIds((b) => new Set([...b].filter((id) => !ids.includes(id))));
    }
  }

  async function confirmReject() {
    if (!rejecting || !reason.trim()) return;
    if (await decide(rejecting, "REJECTED", reason.trim())) {
      setRejecting(null);
      setReason("");
    }
  }

  const colCount = canApprove ? 11 : 10;

  return (
    <>
      <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2 min-h-9">
        <p className="text-xs text-slate-500">
          {openQueries > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <MessageSquareWarning className="h-3.5 w-3.5" /> {openQueries} with an open staff query (highlighted)
            </span>
          ) : (
            "Approve or reject submitted entries here, or open one for full details and staff queries."
          )}
        </p>
        {canApprove && selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">{selectedIds.length} selected</span>
            <Button size="sm" onClick={() => decide(selectedIds, "APPROVED")} disabled={busyIds.size > 0}>
              <Check className="h-4 w-4" /> Approve selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => setRejecting(selectedIds)}
              disabled={busyIds.size > 0}
            >
              <X className="h-4 w-4" /> Reject selected
            </Button>
          </div>
        )}
      </div>

      <Card className="overflow-x-auto">
        <table className="table-clean">
          <thead>
            <tr>
              {canApprove && (
                <th className="w-8">
                  <Checkbox
                    aria-label="Select all submitted"
                    checked={allSelected}
                    disabled={submittedIds.length === 0}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(submittedIds) : new Set())}
                  />
                </th>
              )}
              <th>Date</th>
              <th>Employee</th>
              <th>Client</th>
              <th>Activity</th>
              <th>Task</th>
              <th>Description</th>
              <th className="text-right">Hours</th>
              <th>Type</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="text-center py-12 text-slate-400">No entries match these filters.</td>
              </tr>
            )}
            {rows.map((r) => {
              const submitted = r.status === "SUBMITTED";
              const busy = busyIds.has(r.id);
              const openQuery = r.queryStatus === "OPEN";
              return (
                <tr
                  key={r.id}
                  className={openQuery ? "bg-amber-50 shadow-[inset_3px_0_0_0_theme(colors.amber.400)]" : undefined}
                >
                  {canApprove && (
                    <td>
                      {submitted && (
                        <Checkbox
                          aria-label={`Select entry ${r.id}`}
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) => toggle(r.id, v === true)}
                          disabled={busy}
                        />
                      )}
                    </td>
                  )}
                  <td className="font-medium whitespace-nowrap">{formatDate(r.date)}</td>
                  <td>
                    <p className="font-medium">{r.userName}</p>
                    <p className="text-xs text-slate-500 font-mono">{r.employeeCode}</p>
                  </td>
                  <td><span className="font-mono text-xs">{r.clientCode}</span></td>
                  <td className="font-mono text-xs">{r.activityCode}</td>
                  <td>
                    <p className="font-mono text-xs">{r.taskCode}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[180px]">{r.taskName}</p>
                  </td>
                  <td className="max-w-xs truncate">{r.description}</td>
                  <td className="text-right font-semibold tabular-nums">{r.hours.toFixed(2)}</td>
                  <td className="text-xs">{r.type}</td>
                  <td>
                    <div className="flex flex-col items-start gap-1">
                      <StatusPill status={r.status} />
                      {r.queryStatus && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${openQuery ? "text-amber-700" : "text-slate-400"}`}
                          title={`${r.commentCount} comment${r.commentCount === 1 ? "" : "s"}`}
                        >
                          <MessageSquareWarning className="h-3 w-3" />
                          {openQuery ? "Query open" : "Query resolved"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {canApprove && submitted && (
                        busy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400 mx-2" />
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              title={openQuery ? "Approve (query still open)" : "Approve"}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => decide([r.id], "APPROVED")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Reject"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setRejecting([r.id])}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )
                      )}
                      <Button asChild size="sm" variant="ghost" title="Open full entry">
                        <Link href={`/admin/timesheets/${r.id}`}>
                          <ExternalLink className="h-3.5 w-3.5" /> View
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {rejecting && (
        <Dialog open onOpenChange={(o) => !o && busyIds.size === 0 && setRejecting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Reject {rejecting.length === 1 ? "entry" : `${rejecting.length} entries`}
              </DialogTitle>
              <DialogDescription>
                The employee sees this reason and can fix and resubmit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea
                id="reject-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Hours don't match the task, please split by day"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejecting(null)} disabled={busyIds.size > 0}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={busyIds.size > 0 || !reason.trim()}>
                {busyIds.size > 0 && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
