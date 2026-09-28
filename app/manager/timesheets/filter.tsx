"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export function TimesheetsFilter({
  clients,
  users,
  initial,
}: {
  clients: Array<{ id: number; clientCode: string; clientName: string }>;
  users: Array<{ id: number; name: string; employeeCode: string }>;
  initial: any;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status ?? "");
  const [clientId, setClientId] = useState(initial.clientId ?? "");
  const [userId, setUserId] = useState(initial.userId ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [query, setQuery] = useState(initial.query ?? "");

  function apply() {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (clientId) sp.set("clientId", clientId);
    if (userId) sp.set("userId", userId);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (query) sp.set("query", query);
    router.push(`/manager/timesheets?${sp.toString()}`);
  }

  function clear() {
    setStatus(""); setClientId(""); setUserId(""); setFrom(""); setTo(""); setQuery("");
    router.push("/manager/timesheets");
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">Filters</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        <div>
          <Label className="mb-1 block">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Any client" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  <span className="font-mono text-xs mr-2">{c.clientCode}</span>{c.clientName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">Employee</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Any employee" /></SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id.toString()}>
                  {u.name} <span className="font-mono text-xs ml-2 text-slate-500">{u.employeeCode}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">Staff query</Label>
          <Select value={query} onValueChange={setQuery}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open queries</SelectItem>
              <SelectItem value="mine">Open, tagged me</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={apply} className="flex-1">Apply</Button>
          <Button variant="ghost" size="icon" onClick={clear} title="Clear filters">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
