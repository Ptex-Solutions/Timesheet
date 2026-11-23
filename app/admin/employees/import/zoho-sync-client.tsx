"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle2,
  Users,
  Search,
  ExternalLink,
  Check,
  Key,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  connectZoho,
  fetchZohoEmployees,
  syncEmployeesToDb,
  type ZohoEmployee,
} from "./actions";

export function ZohoSyncClient({
  initialConfig,
  canEdit = true,
}: {
  initialConfig: { configured: boolean; clientId: string };
  canEdit?: boolean;
}) {
  const [isConfigured, setIsConfigured] = useState(initialConfig.configured);
  const [showConfig, setShowConfig] = useState(!initialConfig.configured);

  const [clientId, setClientId] = useState(initialConfig.clientId || "");
  const [clientSecret, setClientSecret] = useState("");
  const [scope, setScope] = useState(
    "ZOHOPEOPLE.forms.READ ZOHOPEOPLE.employee.ALL ZOHOPEOPLE.attendance.READ ZOHOPEOPLE.leave.READ"
  );
  const [authCode, setAuthCode] = useState("");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [employees, setEmployees] = useState<ZohoEmployee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = authCode.replace(/^(Zoho-oauthtoken|Bearer)\s+/i, "").trim();
    if (!clientId.trim() || !clientSecret.trim() || !cleanCode) {
      toast.error("Please fill in Client ID, Client Secret, and Authorization Code.");
      return;
    }

    setIsConnecting(true);
    try {
      const res = await connectZoho({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        code: cleanCode,
      });

      if (res.success) {
        toast.success(res.message);
        setIsConfigured(true);
        setShowConfig(false);
        setAuthCode("");
        loadEmployees();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate token.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function loadEmployees() {
    setIsFetching(true);
    try {
      const res = await fetchZohoEmployees();
      if (res.success) {
        setEmployees(res.employees);
        const newIds = new Set(res.employees.filter((e) => !e.existsInDb).map((e) => e.id));
        setSelectedIds(newIds.size > 0 ? newIds : new Set(res.employees.map((e) => e.id)));
        toast.success(res.message || `Loaded ${res.employees.length} employees from Zoho.`);
      } else {
        toast.error(res.message || "Failed to fetch employees from Zoho.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error fetching employees.");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleSync() {
    const toSync = employees.filter((emp) => selectedIds.has(emp.id));
    if (toSync.length === 0) {
      toast.error("Select at least one employee to import.");
      return;
    }

    setIsSyncing(true);
    try {
      const res = await syncEmployeesToDb(toSync);
      if (res.success) {
        toast.success(res.message);
        await loadEmployees();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync employees to database.");
    } finally {
      setIsSyncing(false);
    }
  }

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.code.toLowerCase().includes(q)
    );
  });

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)));
    }
  };

  const toggleOne = (id: string) => {
    const copy = new Set(selectedIds);
    if (copy.has(id)) copy.delete(id);
    else copy.add(id);
    setSelectedIds(copy);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Configuration Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  isConfigured ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                }`}
              >
                {isConfigured ? <CheckCircle2 className="h-5 w-5" /> : <Key className="h-5 w-5" />}
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {isConfigured ? "Zoho Connected (Auto-Refresh Active)" : "Zoho API Configuration"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isConfigured
                    ? "Tokens are saved securely in .env. Access tokens are automatically refreshed in the background."
                    : "Enter your Zoho credentials and Authorization Code to establish the initial connection."}
                </CardDescription>
              </div>
            </div>

            {isConfigured && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs"
              >
                {showConfig ? "Hide Config" : "Update Credentials"}
              </Button>
            )}
          </div>
        </CardHeader>

        {showConfig && (
          <CardContent className="pt-2 border-t border-slate-100">
            <form onSubmit={handleConnect} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="clientId" className="text-xs font-medium">
                    Client ID (CI)
                  </Label>
                  <Input
                    id="clientId"
                    placeholder="e.g. 1000.40QXIXNSJFZULDOI1852PM6U12MEPP"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="clientSecret" className="text-xs font-medium">
                    Client Secret (CS)
                  </Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    placeholder="Enter Client Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scope" className="text-xs font-medium">
                  Scope
                </Label>
                <Input
                  id="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="font-mono text-xs text-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="authCode" className="text-xs font-medium">
                    Authorization Code (Initial Connection)
                  </Label>
                  <a
                    href="https://api-console.zoho.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Open Zoho Console <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="authCode"
                  placeholder="Paste the code from Zoho Console (accounts.zoho.com/oauth/v2/token)"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={isConnecting || !canEdit} size="sm" className="gap-2">
                  {isConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    "Connect / Generate Token"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Employee List & Database Sync Section */}
      {isConfigured && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Zoho Employees & Sync
                </CardTitle>
                <CardDescription className="text-xs">
                  Fetched via Zoho People API (<code className="text-slate-600">/api/forms/employee/getRecords</code>).
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadEmployees}
                  disabled={isFetching}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  Fetch from Zoho
                </Button>

                {employees.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing || selectedIds.size === 0 || !canEdit}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSyncing ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Import Selected ({selectedIds.size}) to DB
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {employees.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-700">No employee data loaded yet</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Click the button below to fetch employee records from your Zoho People account.
                </p>
                <Button onClick={loadEmployees} disabled={isFetching} size="sm" className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  {isFetching ? "Fetching from Zoho..." : "Fetch Zoho Employees"}
                </Button>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, or employee code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                {/* Clean Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filtered.length > 0 && selectedIds.size === filtered.length}
                            onChange={toggleAll}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="p-3">Emp Code</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Joining Date</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((emp) => {
                        const isChecked = selectedIds.has(emp.id);
                        return (
                          <tr
                            key={emp.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              isChecked ? "bg-blue-50/40" : ""
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleOne(emp.id)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-3 font-mono text-xs font-semibold text-slate-700">
                              {emp.code}
                            </td>
                            <td className="p-3 font-medium text-slate-900">{emp.name}</td>
                            <td className="p-3 text-slate-600">{emp.email}</td>
                            <td className="p-3 text-xs text-slate-600">{emp.joiningDate || "—"}</td>
                            <td className="p-3">
                              {emp.existsInDb ? (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                  <Check className="h-3 w-3 text-emerald-600" /> In DB
                                </span>
                              ) : (
                                <Badge className="bg-emerald-600 text-white text-[11px] font-normal">
                                  New
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-slate-500 pt-1 gap-1">
                  <span>Selected: <strong>{selectedIds.size}</strong> of {filtered.length} employees</span>
                  <span>Default password for new users: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">Ptex@123</code> (Role: <strong>EMPLOYEE</strong>)</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
