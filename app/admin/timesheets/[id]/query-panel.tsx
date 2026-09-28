"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock, MessageSquareWarning, RotateCcw, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { QueryThread, StaffUser } from "@/lib/timesheet-query";

// Staff-only discussion on an entry. Posting opens the query; "Query
// Resolved" closes it. Tag colleagues with @Name.
export function QueryPanel({
  timesheetId,
  initial,
  staff,
  currentUserId,
}: {
  timesheetId: number;
  initial: QueryThread;
  staff: StaffUser[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [thread, setThread] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<"post" | "status" | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return staff
      .filter((s) => s.id !== currentUserId)
      .filter((s) => s.name.toLowerCase().includes(q) || s.employeeCode.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, staff, currentUserId]);

  // Detect "@partial" right before the caret.
  function onBodyChange(value: string, caret: number) {
    setBody(value);
    const m = /(^|\s)@([\w.-]*)$/.exec(value.slice(0, caret));
    setMentionQuery(m ? m[2] : null);
    setHighlight(0);
  }

  function insertMention(s: StaffUser) {
    const el = textRef.current;
    const caret = el?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@([\w.-]*)$/, `@${s.name} `);
    const next = before + body.slice(caret);
    setBody(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  }

  // Tagged users = staff whose "@Name" is still present in the text.
  const mentionIds = useMemo(
    () => staff.filter((s) => s.id !== currentUserId && body.includes(`@${s.name}`)).map((s) => s.id),
    [body, staff, currentUserId]
  );

  async function post() {
    if (!body.trim()) return;
    setBusy("post");
    try {
      const r = await fetch(`/api/timesheets/${timesheetId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), mentionIds }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || `Failed (HTTP ${r.status})`);
        return;
      }
      setThread(j.data);
      setBody("");
      toast.success(mentionIds.length ? `Posted and tagged ${mentionIds.length}` : "Posted");
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: "OPEN" | "RESOLVED") {
    setBusy("status");
    try {
      const r = await fetch(`/api/timesheets/${timesheetId}/query`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || `Failed (HTTP ${r.status})`);
        return;
      }
      setThread(j.data);
      toast.success(status === "RESOLVED" ? "Query resolved" : "Query reopened");
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  const open = thread.status === "OPEN";

  return (
    <Card className={open ? "border-amber-300 ring-1 ring-amber-200" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-amber-600" /> Staff Query
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Lock className="h-3 w-3" /> Internal — only staff can see this.
            </CardDescription>
          </div>
          {thread.status && (
            <Badge variant={open ? "warning" : "success"}>{open ? "Open" : "Resolved"}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {thread.comments.length === 0 ? (
          <p className="text-sm text-slate-500">
            No queries yet. Post a comment to raise one and tag a colleague with <span className="font-mono">@</span>.
          </p>
        ) : (
          <ol className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {thread.comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-navy">{c.author.name}</p>
                  <p className="text-[11px] text-slate-400">{new Date(c.createdAt).toLocaleString("en-IN")}</p>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap break-words">{renderBody(c.body, c.mentions)}</p>
              </li>
            ))}
          </ol>
        )}

        {thread.status === "RESOLVED" && thread.resolvedBy && (
          <p className="text-xs text-emerald-700">
            Resolved by {thread.resolvedBy}
            {thread.resolvedAt ? ` · ${new Date(thread.resolvedAt).toLocaleString("en-IN")}` : ""}. A new comment
            reopens it.
          </p>
        )}

        <div className="relative space-y-2">
          <Textarea
            ref={textRef}
            rows={3}
            placeholder="Describe the issue… type @ to tag a colleague"
            value={body}
            onChange={(e) => onBodyChange(e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => {
              if (suggestions.length) {
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
                if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(suggestions[highlight]); return; }
                if (e.key === "Escape") { setMentionQuery(null); return; }
              }
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) post();
            }}
            disabled={busy !== null}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(s); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${i === highlight ? "bg-slate-100" : "hover:bg-slate-50"}`}
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{s.employeeCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {mentionIds.length > 0 && (
            <p className="text-xs text-slate-500">
              Tagging: {staff.filter((s) => mentionIds.includes(s.id)).map((s) => s.name).join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {open && (
              <Button variant="outline" size="sm" onClick={() => setStatus("RESOLVED")} disabled={busy !== null}>
                {busy === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Query Resolved
              </Button>
            )}
            {thread.status === "RESOLVED" && (
              <Button variant="ghost" size="sm" onClick={() => setStatus("OPEN")} disabled={busy !== null}>
                <RotateCcw className="h-4 w-4" /> Reopen
              </Button>
            )}
          </div>
          <Button size="sm" onClick={post} disabled={busy !== null || !body.trim()}>
            {busy === "post" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Bold the @Name of each tagged user.
function renderBody(body: string, mentions: Array<{ id: number; name: string }>) {
  if (!mentions.length) return body;
  const names = mentions.map((m) => `@${m.name}`).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return body.split(re).map((part, i) =>
    names.includes(part) ? (
      <span key={i} className="font-semibold text-brand">{part}</span>
    ) : (
      part
    )
  );
}
