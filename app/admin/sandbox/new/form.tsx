"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewSandboxForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!label.trim() || !from || !to) {
      toast.error("All fields required");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxLabel: label, dateFrom: from, dateTo: to, status: "APPROVED" }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed to create sandbox");
        return;
      }
      toast.success(`Sandbox created with ${j.data.rows} rows`);
      router.push(`/admin/sandbox/${encodeURIComponent(label)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Sandbox label</Label>
        <Input
          placeholder="e.g. April 2026 MIS Draft v1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Date from</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Date to</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Create sandbox
      </Button>
    </div>
  );
}
