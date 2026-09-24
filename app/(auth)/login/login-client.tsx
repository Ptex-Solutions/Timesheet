"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isStaffRole } from "@/lib/permissions";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        toast.error("Invalid email or password");
        return;
      }
      const from = params.get("from");
      // Determine destination by reading session
      const sess = await fetch("/api/auth/session").then((r) => r.json());
      const role = sess?.user?.role;
      const dest = from && from.startsWith("/employee") || from && from.startsWith("/manager")
        ? from
        : isStaffRole(role)
        ? "/manager/dashboard"
        : "/employee/dashboard";
      router.push(dest);
      router.refresh();
    } catch (err) {
      toast.error("Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  function fill(role: "manager" | "employee") {
    if (role === "manager") {
      setEmail("himanshu@ptexsolutions.com");
      setPassword("Manager@123");
    } else {
      setEmail("tqureshi@ptexsolutions.com");
      setPassword("Taha@123");
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center font-bold text-lg text-white shadow-brand">
          P
        </div>
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-navy">Ptex</p>
          <p className="text-xs text-slate-500 -mt-0.5">Management Dashboard</p>
        </div>
      </div>

      <h2 className="font-display text-3xl font-bold tracking-tight text-navy">Welcome back</h2>
      <p className="mt-2 text-slate-500">Sign in with your Ptex account to continue.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@ptex.com"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              className="pl-9 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-4 bg-slate-50/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Demo accounts</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fill("manager")} type="button">
            Use Manager
          </Button>
          <Button variant="outline" size="sm" onClick={() => fill("employee")} type="button">
            Use Employee
          </Button>
        </div>
      </div>
    </div>
  );
}
