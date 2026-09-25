"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Clock, FileText, Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { weekLabelForDate, isoYearWeek, weekdayKey } from "@/lib/utils";

type ClientMaster = { id: number; code: string; description: string | null };

type Activity = {
  id: number;
  activityId: string;
  name: string;
  clientId: number;
  type: { id: number; code: string; description: string | null };
  tasks: Array<{ id: number; taskId: string; taskName: string; poRef: string | null }>;
};

export function TimesheetForm({
  initial,
  mode = "create",
  timesheetId,
}: {
  initial?: any;
  mode?: "create" | "edit";
  timesheetId?: number;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(initial?.date?.slice?.(0, 10) ?? today);
  const [clientId, setClientId] = useState<number | null>(initial?.clientId ?? null);
  const [activityId, setActivityId] = useState<number | null>(initial?.activityId ?? null);
  const [taskId, setTaskId] = useState<number | null>(initial?.taskId ?? null);
  const [hours, setHours] = useState<number>(Number(initial?.hours ?? 0));
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [submitting, setSubmitting] = useState<"draft" | "submit" | null>(null);

  // Explicitly request active-only rows so a staff member with clients.view
  // filling out their own employee timesheet never sees inactive masters /
  // activities (which would 400 on save).
  const { data: clientsData } = useQuery({
    queryKey: ["masters", "CLIENT"],
    queryFn: async () => {
      const r = await fetch("/api/masters?type=CLIENT&active=1");
      const j = await r.json();
      return (j.data ?? []) as ClientMaster[];
    },
  });

  const { data: activitiesData } = useQuery({
    queryKey: ["activities", clientId],
    enabled: clientId != null,
    queryFn: async () => {
      const r = await fetch(`/api/activities?clientId=${clientId}&active=1`);
      const j = await r.json();
      return (j.data ?? []) as Activity[];
    },
  });

  const clients = clientsData ?? [];
  const selectedClient = clients.find((c) => c.id === clientId);
  const activities = activitiesData ?? [];
  const selectedActivity = activities.find((a) => a.id === activityId);
  const tasks = selectedActivity?.tasks ?? [];
  const selectedTask = tasks.find((t) => t.id === taskId);

  // Auto-clear cascading selections once the dependent list has loaded
  useEffect(() => {
    if (activitiesData && activityId && !activitiesData.find((a) => a.id === activityId)) {
      setActivityId(null);
      setTaskId(null);
    }
  }, [activitiesData, activityId]);

  useEffect(() => {
    if (selectedActivity && taskId && !selectedActivity.tasks.find((t) => t.id === taskId)) {
      setTaskId(null);
    }
  }, [selectedActivity, taskId]);

  const dateInfo = useMemo(() => {
    const d = new Date(date);
    return {
      weekLabel: weekLabelForDate(d),
      weekNo: isoYearWeek(d).week,
      day: weekdayKey(d).toUpperCase(),
      dayName: d.toLocaleDateString("en-US", { weekday: "long" }),
    };
  }, [date]);

  async function save(status: "DRAFT" | "SUBMITTED") {
    if (!clientId || !activityId || !taskId) {
      toast.error("Please choose a client, activity and task");
      return;
    }
    if (hours <= 0) {
      toast.error("Hours must be greater than 0");
      return;
    }
    if (!description.trim()) {
      toast.error("Please add a description");
      return;
    }
    setSubmitting(status === "DRAFT" ? "draft" : "submit");
    try {
      const url = mode === "edit" ? `/api/timesheets/${timesheetId}` : "/api/timesheets";
      const method = mode === "edit" ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          clientId,
          activityId,
          taskId,
          hours,
          description,
          status,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed to save");
        return;
      }
      toast.success(status === "DRAFT" ? "Saved as draft" : "Submitted for approval");
      router.push("/employee/timesheet");
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Timesheet Entry</CardTitle>
          <CardDescription>Record one task per row. Auto-calculates week, day & minutes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="date" className="pl-9" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hours</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  className="pl-9"
                  value={hours}
                  onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Client Code</Label>
              <Select
                value={clientId?.toString() ?? ""}
                onValueChange={(v) => {
                  setClientId(parseInt(v, 10));
                  setActivityId(null);
                  setTaskId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      <span className="font-mono text-xs mr-2">{c.code}</span>
                      {c.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Activity ID</Label>
              <Select
                value={activityId?.toString() ?? ""}
                onValueChange={(v) => {
                  setActivityId(parseInt(v, 10));
                  setTaskId(null);
                }}
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clientId ? "Choose activity..." : "Pick a client first"} />
                </SelectTrigger>
                <SelectContent>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      <span className="font-mono text-xs mr-2">{a.activityId}</span>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Beeline Task</Label>
              <Select value={taskId?.toString() ?? ""} onValueChange={(v) => setTaskId(parseInt(v, 10))} disabled={!activityId}>
                <SelectTrigger>
                  <SelectValue placeholder={activityId ? "Choose task..." : "Pick an activity first"} />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      <span className="font-mono text-xs mr-2">{t.taskId}</span>
                      {t.taskName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
                {selectedActivity ? (
                  <Badge variant="brand">{selectedActivity.type.code}</Badge>
                ) : (
                  <span className="text-slate-400">Set by the selected activity</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Textarea
                rows={4}
                className="pl-9"
                placeholder="What did you work on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={() => save("SUBMITTED")} disabled={submitting !== null}>
              {submitting === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit
            </Button>
            <Button variant="outline" onClick={() => save("DRAFT")} disabled={submitting !== null}>
              {submitting === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save as Draft
            </Button>
            <Button variant="ghost" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Auto-derived</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Week No." value={`Week ${dateInfo.weekNo}`} />
            <Row label="Week Label" value={dateInfo.weekLabel} />
            <Row label="Day" value={`${dateInfo.dayName} (${dateInfo.day})`} />
            <Row label="Minutes" value={`${Math.round(hours * 60)} mins`} />
            {selectedTask?.poRef && <Row label="PO Ref" value={selectedTask.poRef} mono />}
          </CardContent>
        </Card>

        {selectedTask && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Selected Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Badge variant="brand">{selectedTask.taskId}</Badge>
              <p className="text-slate-700 mt-2">{selectedTask.taskName}</p>
              {selectedClient && (
                <p className="text-xs text-slate-500 mt-2">
                  {selectedClient.code} · {selectedActivity?.activityId}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`font-medium text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
