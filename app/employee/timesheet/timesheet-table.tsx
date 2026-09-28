"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Save, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, isoYearWeek, weekLabelForDate } from "@/lib/utils";
import { TimesheetActions } from "./actions";

export type TimesheetRow = {
  id: number;
  date: string; // ISO timestamp
  weekNo: number;
  weekLabel: string;
  clientId: number;
  clientCode: string;
  activityId: number;
  activityCode: string;
  taskId: number;
  taskCode: string;
  taskName: string;
  description: string;
  hours: number;
  type: string;
  status: string;
  rejectionNote: string | null;
};

type Activity = {
  id: number;
  activityId: string;
  name: string;
  clientId: number;
  client: { id: number; code: string; description: string | null };
  type: { id: number; code: string; description: string | null };
  tasks: Array<{ id: number; taskId: string; taskName: string; poRef: string | null }>;
};

type Draft = {
  key: number;
  date: string;
  clientId: number | null;
  activityId: number | null;
  taskId: number | null;
  hours: string;
  description: string;
  saving?: boolean;
  error?: string;
};

type Prefill = Partial<Pick<Draft, "clientId" | "activityId" | "taskId" | "hours" | "description">>;

// Local calendar date (toISOString would give the UTC date, i.e. yesterday in
// IST before 05:30).
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let nextKey = 1;

export function TimesheetTable({ rows, autoAdd = false }: { rows: TimesheetRow[]; autoAdd?: boolean }) {
  const router = useRouter();
  // ?add=1 (dashboard "New Entry" links) opens with one blank row.
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    autoAdd
      ? [{ key: nextKey++, date: todayIso(), clientId: null, activityId: null, taskId: null, hours: "", description: "" }]
      : []
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  // One request covers the whole Client → Activity → Task cascade. active=1
  // keeps inactive rows out even for staff filling their own timesheet.
  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ["activities", "active-all"],
    queryFn: async () => {
      const r = await fetch("/api/activities?active=1");
      const j = await r.json();
      return (j.data ?? []) as Activity[];
    },
  });
  const activities = useMemo(() => activitiesData ?? [], [activitiesData]);

  const clients = useMemo(() => {
    const byId = new Map<number, Activity["client"]>();
    for (const a of activities) byId.set(a.client.id, a.client);
    return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [activities]);

  function addDraft(prefill: Prefill = {}) {
    const activity = activities.find((a) => a.id === prefill.activityId);
    // Only keep prefilled refs that are still active (a cloned entry may point
    // at an activity/task that has since been deactivated).
    const task = activity?.tasks.find((t) => t.id === prefill.taskId);
    setDrafts((d) => [
      {
        key: nextKey++,
        date: todayIso(),
        clientId: activity ? activity.clientId : prefill.clientId ?? null,
        activityId: activity ? activity.id : null,
        taskId: task ? task.id : null,
        hours: prefill.hours ?? "",
        description: prefill.description ?? "",
      },
      ...d,
    ]);
  }

  function updateDraft(key: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch, error: undefined } : x)));
  }

  function removeDraft(key: number) {
    setDrafts((d) => d.filter((x) => x.key !== key));
  }

  function validate(d: Draft): string | null {
    if (!d.date) return "Date is required";
    if (!d.clientId || !d.activityId || !d.taskId) return "Choose client, activity and task";
    const h = Number(d.hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) return "Hours must be between 0 and 24";
    if (!d.description.trim()) return "Description is required";
    return null;
  }

  // Saves one draft; returns true on success. Does not refresh the page.
  async function saveDraft(d: Draft, status: "DRAFT" | "SUBMITTED"): Promise<boolean> {
    const problem = validate(d);
    if (problem) {
      setDrafts((all) => all.map((x) => (x.key === d.key ? { ...x, error: problem } : x)));
      return false;
    }
    setDrafts((all) => all.map((x) => (x.key === d.key ? { ...x, saving: true, error: undefined } : x)));
    try {
      const r = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: d.date,
          clientId: d.clientId,
          activityId: d.activityId,
          taskId: d.taskId,
          hours: Number(d.hours),
          description: d.description.trim(),
          status,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const error = j.error || `Save failed (HTTP ${r.status})`;
        setDrafts((all) => all.map((x) => (x.key === d.key ? { ...x, saving: false, error } : x)));
        return false;
      }
      setDrafts((all) => all.filter((x) => x.key !== d.key));
      return true;
    } catch {
      setDrafts((all) =>
        all.map((x) => (x.key === d.key ? { ...x, saving: false, error: "Could not reach the server" } : x))
      );
      return false;
    }
  }

  async function saveOne(d: Draft, status: "DRAFT" | "SUBMITTED") {
    if (await saveDraft(d, status)) {
      toast.success(status === "DRAFT" ? "Saved as draft" : "Submitted for approval");
      router.refresh();
    }
  }

  async function saveAll(status: "DRAFT" | "SUBMITTED") {
    setBulkBusy(true);
    let ok = 0;
    // Sequential on purpose: the server's 24h-per-day cap is checked against
    // rows already saved, so parallel posts for the same date could race it.
    for (const d of drafts) {
      if (await saveDraft(d, status)) ok++;
    }
    setBulkBusy(false);
    const failed = drafts.length - ok;
    if (ok) router.refresh();
    if (failed === 0) toast.success(`${ok} ${ok === 1 ? "entry" : "entries"} ${status === "DRAFT" ? "saved" : "submitted"}`);
    else toast.error(`${ok} saved, ${failed} need attention — see the highlighted rows`);
  }

  function cloneRow(r: TimesheetRow) {
    addDraft({
      clientId: r.clientId,
      activityId: r.activityId,
      taskId: r.taskId,
      hours: String(r.hours),
      description: r.description,
    });
  }

  const busy = bulkBusy || drafts.some((d) => d.saving);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-slate-500">
          Add rows directly in the table, or clone an existing entry — only change the date, hours and description.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {drafts.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => saveAll("DRAFT")} disabled={busy}>
                {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save all ({drafts.length})
              </Button>
              <Button variant="outline" size="sm" onClick={() => saveAll("SUBMITTED")} disabled={busy}>
                <Send className="h-4 w-4" /> Save &amp; submit all
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => addDraft()} disabled={activitiesLoading}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Date</th>
              <th>Week</th>
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
            {drafts.map((d) => (
              <DraftRow
                key={d.key}
                draft={d}
                clients={clients}
                activities={activities}
                disabled={bulkBusy}
                onChange={(patch) => updateDraft(d.key, patch)}
                onSave={(status) => saveOne(d, status)}
                onClone={() =>
                  addDraft({
                    clientId: d.clientId ?? undefined,
                    activityId: d.activityId ?? undefined,
                    taskId: d.taskId ?? undefined,
                    hours: d.hours,
                    description: d.description,
                  })
                }
                onRemove={() => removeDraft(d.key)}
              />
            ))}

            {rows.length === 0 && drafts.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400">
                  No timesheets yet.
                  <button
                    type="button"
                    onClick={() => addDraft()}
                    className="text-brand font-semibold ml-1 hover:underline"
                  >
                    Add your first row
                  </button>
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <Fragment key={r.id}>
              <tr className={r.status === "REJECTED" ? "bg-red-50/40" : undefined}>
                <td className="font-medium whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="text-xs text-slate-500 font-mono whitespace-nowrap">W{r.weekNo} · {r.weekLabel}</td>
                <td><span className="font-mono text-xs">{r.clientCode}</span></td>
                <td className="font-mono text-xs">{r.activityCode}</td>
                <td>
                  <p className="text-xs font-mono">{r.taskCode}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[180px]">{r.taskName}</p>
                </td>
                <td className="max-w-xs truncate">{r.description}</td>
                <td className="text-right font-semibold tabular-nums">{r.hours.toFixed(2)}</td>
                <td className="text-xs">{r.type}</td>
                <td><StatusPill status={r.status} /></td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Clone as new row"
                      onClick={() => cloneRow(r)}
                      disabled={activitiesLoading}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <TimesheetActions id={r.id} status={r.status} />
                  </div>
                </td>
              </tr>
              {r.status === "REJECTED" && (
                <tr className="bg-red-50/40">
                  <td colSpan={10} className="pt-0 text-xs text-red-700">
                    <span className="font-semibold">Rejected:</span> {r.rejectionNote || "No reason given."}{" "}
                    <span className="text-red-600/80">Edit it and resubmit.</span>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function DraftRow({
  draft,
  clients,
  activities,
  disabled,
  onChange,
  onSave,
  onClone,
  onRemove,
}: {
  draft: Draft;
  clients: Activity["client"][];
  activities: Activity[];
  disabled: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onSave: (status: "DRAFT" | "SUBMITTED") => void;
  onClone: () => void;
  onRemove: () => void;
}) {
  const clientActivities = activities.filter((a) => a.clientId === draft.clientId);
  const activity = activities.find((a) => a.id === draft.activityId);
  const tasks = activity?.tasks ?? [];
  const locked = disabled || !!draft.saving;

  const week = useMemo(() => {
    if (!draft.date) return "";
    const d = new Date(draft.date);
    return Number.isNaN(d.getTime()) ? "" : `W${isoYearWeek(d).week} · ${weekLabelForDate(d)}`;
  }, [draft.date]);

  return (
    <>
      <tr className={draft.error ? "bg-red-50/60" : "bg-amber-50/40"}>
        <td>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={draft.date}
            onChange={(e) => onChange({ date: e.target.value })}
            disabled={locked}
          />
        </td>
        <td className="text-xs text-slate-500 font-mono whitespace-nowrap">{week}</td>
        <td>
          <Select
            value={draft.clientId?.toString() ?? ""}
            onValueChange={(v) => onChange({ clientId: Number(v), activityId: null, taskId: null })}
            disabled={locked}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  <span className="font-mono text-xs">{c.code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td>
          <Select
            value={draft.activityId?.toString() ?? ""}
            onValueChange={(v) => {
              const a = activities.find((x) => x.id === Number(v));
              // Auto-pick the task when the activity has only one.
              onChange({ activityId: Number(v), taskId: a?.tasks.length === 1 ? a.tasks[0].id : null });
            }}
            disabled={locked || !draft.clientId}
          >
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder={draft.clientId ? "Activity" : "Pick client"} />
            </SelectTrigger>
            <SelectContent>
              {clientActivities.map((a) => (
                <SelectItem key={a.id} value={a.id.toString()}>
                  <span className="font-mono text-xs mr-2">{a.activityId}</span>
                  <span className="text-xs text-slate-500">{a.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td>
          <Select
            value={draft.taskId?.toString() ?? ""}
            onValueChange={(v) => onChange({ taskId: Number(v) })}
            disabled={locked || !draft.activityId}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder={draft.activityId ? "Task" : "Pick activity"} />
            </SelectTrigger>
            <SelectContent>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  <span className="font-mono text-xs mr-2">{t.taskId}</span>
                  <span className="text-xs text-slate-500">{t.taskName}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td>
          <Input
            className="h-8 min-w-[200px] text-xs"
            placeholder="What did you work on?"
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && !locked && onSave("DRAFT")}
            disabled={locked}
          />
        </td>
        <td>
          <Input
            type="number"
            step="0.25"
            min="0"
            max="24"
            className="h-8 w-20 text-xs text-right tabular-nums"
            placeholder="0.00"
            value={draft.hours}
            onChange={(e) => onChange({ hours: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && !locked && onSave("DRAFT")}
            disabled={locked}
          />
        </td>
        <td className="text-xs">{activity?.type.code ?? <span className="text-slate-300">—</span>}</td>
        <td>
          <Badge variant="warning">New</Badge>
        </td>
        <td>
          <div className="flex items-center justify-end gap-1">
            {draft.saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <>
                <Button size="icon" variant="ghost" title="Save as draft" onClick={() => onSave("DRAFT")} disabled={locked}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" title="Save & submit" onClick={() => onSave("SUBMITTED")} disabled={locked}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" title="Clone this row" onClick={onClone} disabled={locked}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Remove row"
                  onClick={onRemove}
                  disabled={locked}
                  className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {draft.error && (
        <tr className="bg-red-50/60">
          <td colSpan={10} className="pt-0 text-xs text-red-600">
            {draft.error}
          </td>
        </tr>
      )}
    </>
  );
}
