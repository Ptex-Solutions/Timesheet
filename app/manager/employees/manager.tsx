"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, PlusCircle, Trash2, UserPlus, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Role } from "@/lib/permissions";

type Row = {
  id: number;
  name: string;
  email: string;
  role: Role;
  employeeCode: string;
  isActive: boolean;
  createdAt: string;
};

export function EmployeesManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  async function deactivate(id: number) {
    if (!confirm("Deactivate this user?")) return;
    const r = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Deactivated");
      router.refresh();
    } else toast.error("Failed");
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4" /> Add employee
        </Button>
      </div>

      <Card>
        <table className="table-clean">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Code</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((u) => {
              const initials = u.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
              return (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-navy">{u.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">{u.email}</td>
                  <td><span className="font-mono text-xs">{u.employeeCode}</span></td>
                  <td>
                    {u.role === "MANAGER" ? (
                      <Badge variant="brand"><ShieldCheck className="h-3 w-3 mr-1" /> Manager</Badge>
                    ) : (
                      <Badge variant="info">Employee</Badge>
                    )}
                  </td>
                  <td>
                    {u.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="default"><ShieldOff className="h-3 w-3 mr-1" />Inactive</Badge>}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {u.isActive && (
                        <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => deactivate(u.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {(creating || editing) && (
        <UserDialog
          user={editing ?? undefined}
          mode={creating ? "create" : "edit"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function UserDialog({ user, mode, onClose }: { user?: Row; mode: "create" | "edit"; onClose: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYEE");
  const [employeeCode, setEmployeeCode] = useState(user?.employeeCode ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim() || !email.trim() || !employeeCode.trim()) {
      toast.error("All fields required");
      return;
    }
    if (mode === "create" && !password) {
      toast.error("Password required");
      return;
    }
    setBusy(true);
    try {
      const body: any = { name, email, role, employeeCode };
      if (password) body.password = password;
      if (mode === "edit") body.id = user!.id;

      const r = await fetch("/api/users", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store", 
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Failed");
        return;
      }
      toast.success(mode === "create" ? "Employee added" : "Updated");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Employee" : "Edit Employee"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new account with a temporary password." : "Update profile and role."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employee code</Label>
              <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="e.g. TC" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{mode === "create" ? "Password" : "New password (optional)"}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "edit" ? "Leave blank to keep" : ""} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
