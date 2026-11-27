"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Brief = { id: number; code: string; description: string | null };
type ContractOpt = Brief & { clientId: number; status: string; tasks: Brief[] };
type ActivityOpt = { id: number; activityId: string; name: string; clientId: number; contractId: number | null; isActive: boolean };

const ALL = "__all__";
const label = (m: Brief) => (m.description ? `${m.code} — ${m.description}` : m.code);

export function NewSandboxForm({
  clients,
  contracts,
  activities,
}: {
  clients: Brief[];
  contracts: ContractOpt[];
  activities: ActivityOpt[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [contractId, setContractId] = useState(ALL);
  const [activityId, setActivityId] = useState(ALL);
  const [taskId, setTaskId] = useState(ALL);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<null | { count: number; hours: number } | "loading">(null);

  // Cascade: Client -> Contract -> Activity; Task comes from the contract(s) in scope.
  const clientContracts = useMemo(
    () => contracts.filter((c) => String(c.clientId) === clientId),
    [contracts, clientId]
  );
  const clientActivities = useMemo(
    () =>
      activities.filter(
        (a) => String(a.clientId) === clientId && (contractId === ALL || String(a.contractId) === contractId)
      ),
    [activities, clientId, contractId]
  );
  const taskOptions = useMemo(() => {
    const act = activities.find((a) => String(a.id) === activityId);
    const scope =
      contractId !== ALL
        ? clientContracts.filter((c) => String(c.id) === contractId)
        : act
          ? clientContracts.filter((c) => c.id === act.contractId)
          : clientContracts;
    const seen = new Map<number, Brief>();
    for (const c of scope) for (const t of c.tasks) seen.set(t.id, t);
    return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [activities, activityId, clientContracts, contractId]);

  const filters = () => ({
    clientId: Number(clientId),
    dateFrom: from,
    dateTo: to,
    contractId: contractId === ALL ? null : Number(contractId),
    activityId: activityId === ALL ? null : Number(activityId),
    taskMasterId: taskId === ALL ? null : Number(taskId),
  });
  const ready = !!clientId && !!from && !!to && from <= to;

  // Live count of the timesheets these filters would clone.
  useEffect(() => {
    if (!ready) return setPreview(null);
    setPreview("loading");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/sandbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...filters(), dryRun: true }),
          signal: ctrl.signal,
        });
        const j = await r.json();
        setPreview(r.ok ? j.data : null);
      } catch {
        /* aborted */
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, from, to, contractId, activityId, taskId]);

  async function submit() {
    if (!name.trim()) return void toast.error("Sandbox label is required");
    if (!clientId) return void toast.error("Select a client");
    if (!from || !to) return void toast.error("Pick both dates");
    if (from > to) return void toast.error("Date from must be on or before Date to");
    setBusy(true);
    try {
      const r = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxLabel: name.trim(), ...filters() }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed to create sandbox");
        return;
      }
      toast.success(`Sandbox created with ${j.data.rows} rows`);
      router.push(`/admin/sandbox/${encodeURIComponent(name.trim())}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Sandbox label</Label>
        <Input placeholder="e.g. April 2026 MIS Draft v1" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select
            value={clientId || undefined}
            onValueChange={(v) => {
              setClientId(v);
              setContractId(ALL);
              setActivityId(ALL);
              setTaskId(ALL);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {label(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date from</Label>
          <DatePicker value={from} max={to || undefined} onChange={setFrom} />
        </div>
        <div className="space-y-2">
          <Label>Date to</Label>
          <DatePicker value={to} min={from || undefined} onChange={setTo} />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 p-3 space-y-3">
        <p className="text-xs font-medium text-slate-500">Optional filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Contract</Label>
            <Select
              value={contractId}
              disabled={!clientId}
              onValueChange={(v) => {
                setContractId(v);
                setActivityId(ALL);
                setTaskId(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All contracts</SelectItem>
                {clientContracts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code}
                    {c.status !== "ACTIVE" && ` (${c.status.toLowerCase()})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Activity</Label>
            <Select
              value={activityId}
              disabled={!clientId}
              onValueChange={(v) => {
                setActivityId(v);
                setTaskId(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All activities</SelectItem>
                {clientActivities.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.activityId} — {a.name}
                    {!a.isActive && " (inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Task</Label>
            <Select value={taskId} disabled={!clientId} onValueChange={setTaskId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All tasks</SelectItem>
                {taskOptions.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {label(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Search className="h-4 w-4 text-slate-400" />
          {!ready ? (
            "Pick a client and dates to see matching timesheets."
          ) : preview === "loading" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting…
            </span>
          ) : preview ? (
            <span>
              <strong>{preview.count}</strong> submitted/approved timesheet{preview.count === 1 ? "" : "s"} ·{" "}
              <strong>{preview.hours}</strong> h will be cloned
            </span>
          ) : (
            "Couldn't count matches."
          )}
        </p>
        <Button onClick={submit} disabled={busy || (preview !== null && preview !== "loading" && preview.count === 0)}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create sandbox
        </Button>
      </div>
    </div>
  );
}
