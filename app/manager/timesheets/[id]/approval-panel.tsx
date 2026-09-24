"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function ApprovalPanel({
  id,
  status,
  canApprove,
  canReopen,
}: {
  id: number;
  status: string;
  canApprove: boolean;
  canReopen: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "reopen" | null>(null);

  async function reopen() {
    setBusy("reopen");
    try {
      const r = await fetch(`/api/timesheets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return;
      }
      toast.success("Timesheet re-opened");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(decision === "APPROVED" ? "approve" : "reject");
    try {
      const r = await fetch(`/api/timesheets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decision,
          rejectionNote: decision === "REJECTED" ? note : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return;
      }
      toast.success(decision === "APPROVED" ? "Approved" : "Rejected");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (status === "APPROVED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            This timesheet has been approved.
          </div>
          {canReopen && (
            <Button variant="outline" className="w-full" onClick={reopen} disabled={busy !== null}>
              {busy === "reopen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Re-open
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === "DRAFT") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval</CardTitle>
          <CardDescription>Employee has not submitted yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Waiting for the employee to submit this entry for approval.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "REJECTED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This timesheet was rejected and is awaiting resubmission.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status !== "SUBMITTED" || !canApprove) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No actions available.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision</CardTitle>
        <CardDescription>Approve or reject this submission.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Note (optional for approval, required for rejection)</Label>
          <Textarea
            rows={4}
            placeholder="Add context for the employee..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="success"
            onClick={() => decide("APPROVED")}
            disabled={busy !== null}
          >
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approve
          </Button>
          <Button
            variant="destructive"
            onClick={() => decide("REJECTED")}
            disabled={busy !== null || !note.trim()}
          >
            {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
