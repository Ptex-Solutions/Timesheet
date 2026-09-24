"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Download, Loader2, PieChart, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#E85D04", "#F47B1F", "#0D1B2A", "#33495F", "#5C7187", "#8E9DAE", "#FFB97A"];

export function MISBuilder({
  users,
  clients,
  sandboxes,
  canFinalize,
}: {
  users: Array<{ id: number; name: string; employeeCode: string }>;
  clients: Array<{ id: number; clientCode: string; clientName: string }>;
  sandboxes: Array<{ label: string; count: number }>;
  canFinalize: boolean;
}) {
  const router = useRouter();
  const [source, setSource] = useState<"timesheets" | "sandbox">("timesheets");
  const [sandboxLabel, setSandboxLabel] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [clientIds, setClientIds] = useState<number[]>([]);
  const [title, setTitle] = useState("MIS Report");
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  function toggleId(arr: number[], setter: (n: number[]) => void, id: number) {
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  async function preview() {
    if (!from || !to) return toast.error("Pick a date range");
    if (source === "sandbox" && !sandboxLabel) return toast.error("Pick a sandbox");
    setBusy(true);
    try {
      const r = await fetch("/api/mis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          sandboxLabel: source === "sandbox" ? sandboxLabel : undefined,
          dateFrom: from,
          dateTo: to,
          employeeIds: employeeIds.length ? employeeIds : undefined,
          clientIds: clientIds.length ? clientIds : undefined,
          finalize: false,
        }),
      });
      const j = await r.json();
      if (!r.ok) return toast.error(j.error || "Failed");
      setData(j.data);
      toast.success(`Preview ready · ${j.data.totals.totalRows} rows`);
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    if (!data) return toast.error("Preview first");
    setFinalizing(true);
    try {
      const r = await fetch("/api/mis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          sandboxLabel: source === "sandbox" ? sandboxLabel : undefined,
          dateFrom: from,
          dateTo: to,
          employeeIds: employeeIds.length ? employeeIds : undefined,
          clientIds: clientIds.length ? clientIds : undefined,
          finalize: true,
          title,
        }),
      });
      const j = await r.json();
      if (!r.ok) return toast.error(j.error || "Failed");
      toast.success("MIS finalized");
      router.push(`/manager/mis/${j.data.id}`);
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Step 1 · Source</CardTitle>
          <CardDescription>Choose where data comes from</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSource("timesheets")}
              className={`rounded-lg border p-3 text-left transition ${
                source === "timesheets" ? "border-brand bg-brand-50/40" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold text-navy">Timesheets</p>
              <p className="text-xs text-slate-500">Submitted/approved</p>
            </button>
            <button
              type="button"
              onClick={() => setSource("sandbox")}
              className={`rounded-lg border p-3 text-left transition ${
                source === "sandbox" ? "border-brand bg-brand-50/40" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold text-navy">Sandbox</p>
              <p className="text-xs text-slate-500">Edited snapshot</p>
            </button>
          </div>

          {source === "sandbox" && (
            <div className="space-y-2">
              <Label>Sandbox label</Label>
              <Select value={sandboxLabel} onValueChange={setSandboxLabel}>
                <SelectTrigger><SelectValue placeholder="Choose sandbox..." /></SelectTrigger>
                <SelectContent>
                  {sandboxes.map((s) => (
                    <SelectItem key={s.label} value={s.label}>{s.label} <span className="text-xs text-slate-400 ml-2">({s.count})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Employees ({employeeIds.length || "all"})</Label>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 rounded-lg border border-slate-200 bg-slate-50/40">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleId(employeeIds, setEmployeeIds, u.id)}
                  className={`text-xs px-2 py-1 rounded ${
                    employeeIds.includes(u.id) ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {u.employeeCode}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Clients ({clientIds.length || "all"})</Label>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 rounded-lg border border-slate-200 bg-slate-50/40">
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleId(clientIds, setClientIds, c.id)}
                  className={`text-xs px-2 py-1 rounded font-mono ${
                    clientIds.includes(c.id) ? "bg-navy text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {c.clientCode}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={preview} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate preview
          </Button>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {!data && (
          <Card className="border-dashed">
            <CardContent className="py-20 text-center">
              <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Configure the filters and click <span className="font-semibold text-brand">Generate preview</span> to see MIS aggregations and charts here.</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Mini label="Rows" value={data.totals.totalRows} />
              <Mini label="Hours" value={data.totals.totalHours} />
              <Mini label="Employees" value={data.totals.employees} />
              <Mini label="Clients" value={data.totals.clients} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Step 2 · Preview</CardTitle>
                <CardDescription>Inspect the MIS across views.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="emp">
                  <TabsList>
                    <TabsTrigger value="emp">By Employee</TabsTrigger>
                    <TabsTrigger value="cli">By Client</TabsTrigger>
                    <TabsTrigger value="detail">Detailed</TabsTrigger>
                    <TabsTrigger value="charts">Charts</TabsTrigger>
                  </TabsList>

                  <TabsContent value="emp">
                    <table className="table-clean">
                      <thead><tr><th>Employee</th><th className="text-right">Hours</th><th className="text-right">Mins</th><th className="text-right">Days</th></tr></thead>
                      <tbody>
                        {data.byEmployee.map((e: any) => (
                          <tr key={e.userId}>
                            <td className="font-medium">{e.employee}</td>
                            <td className="text-right tabular-nums font-semibold">{e.hours.toFixed(2)}</td>
                            <td className="text-right tabular-nums">{e.minutes}</td>
                            <td className="text-right tabular-nums">{e.days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TabsContent>

                  <TabsContent value="cli">
                    <table className="table-clean">
                      <thead><tr><th>Client</th><th>Name</th><th className="text-right">Hours</th><th className="text-right">Mins</th></tr></thead>
                      <tbody>
                        {data.byClient.map((c: any) => (
                          <tr key={c.clientId}>
                            <td><span className="font-mono text-xs">{c.clientCode}</span></td>
                            <td>{c.clientName}</td>
                            <td className="text-right tabular-nums font-semibold">{c.hours.toFixed(2)}</td>
                            <td className="text-right tabular-nums">{c.minutes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TabsContent>

                  <TabsContent value="detail">
                    <div className="overflow-auto max-h-[60vh]">
                      <table className="table-clean text-xs">
                        <thead>
                          <tr>
                            <th>Date</th><th>Emp</th><th>Client</th><th>Activity</th><th>Desc</th><th className="text-right">Hrs</th><th>Type</th><th>Task</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.rows.map((r: any, i: number) => (
                            <tr key={i}>
                              <td>{r.date}</td>
                              <td className="font-mono">{r.resource}</td>
                              <td className="font-mono">{r.clientCode}</td>
                              <td className="font-mono">{r.activityId}</td>
                              <td className="max-w-xs truncate">{r.description}</td>
                              <td className="text-right tabular-nums font-semibold">{r.hours.toFixed(2)}</td>
                              <td>{r.type}</td>
                              <td className="font-mono">{r.taskId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  <TabsContent value="charts">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ChartCard title="Hours by Client">
                        <ResponsiveContainer width="100%" height={250}>
                          <RPieChart>
                            <Pie
                              data={data.byClient.map((c: any) => ({ name: c.clientCode, value: c.hours }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label
                            >
                              {data.byClient.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </RPieChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      <ChartCard title="Hours by Type">
                        <ResponsiveContainer width="100%" height={250}>
                          <RPieChart>
                            <Pie
                              data={data.byType.map((t: any) => ({ name: t.type, value: t.hours }))}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={50}
                              outerRadius={80}
                              label
                            >
                              {data.byType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </RPieChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      <ChartCard title="Hours by Week" wide>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={data.byWeek}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="hours" fill="#E85D04" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {canFinalize && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 3 · Finalize</CardTitle>
                  <CardDescription>Save this snapshot as a permanent MIS report.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report title" className="flex-1" />
                    <Button variant="success" onClick={finalize} disabled={finalizing}>
                      {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Finalize MIS
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">After finalizing, you can download Excel/PDF from the report page.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-display text-xl font-bold text-navy tabular-nums">{value}</p>
    </div>
  );
}

function ChartCard({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${wide ? "md:col-span-2" : ""}`}>
      <h4 className="text-sm font-semibold text-slate-700 mb-3">{title}</h4>
      {children}
    </div>
  );
}
