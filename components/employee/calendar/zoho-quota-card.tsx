"use client";

import { SunMedium } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LeaveQuota, formatNum } from "./types";

interface ZohoQuotaCardProps {
  quota: LeaveQuota[];
  currentYear: number;
}

export function ZohoQuotaCard({ quota, currentYear }: ZohoQuotaCardProps) {
  const plQuota = quota.find((q) => q.type === "Privilege Leave") || {
    total: 0,
    taken: 0,
    remaining: 0,
  };
  const compQuota = quota.find((q) => q.type === "Compensatory Off") || {
    total: 0,
    taken: 0,
    remaining: 0,
  };

  const plPercentage = plQuota.total > 0 ? (plQuota.taken / plQuota.total) * 100 : 0;

  return (
    <Card className="border-slate-200 shadow-soft">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-navy flex items-center gap-2">
            <SunMedium className="h-4 w-4 text-sky-600" />
            Zoho Leave Quotas ({currentYear})
          </CardTitle>
          <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
            Synced from HR
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Zoho Card 1: Privilege Leave */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                <SunMedium className="h-4 w-4" />
              </div>
              <span className="font-semibold text-xs text-slate-800">Privilege Leave</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">PL</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-500 text-[11px]">Available</span>
              <p className="font-bold text-emerald-600 font-mono text-sm">
                {formatNum(plQuota.remaining)}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">Booked</span>
              <p className="font-bold text-slate-800 font-mono text-sm">
                {formatNum(plQuota.taken)}
              </p>
            </div>
          </div>
          <Progress value={plPercentage} className="h-1.5" />
        </div>

        {/* Zoho Card 2: Compensatory Off */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-lime-100 text-lime-700 flex items-center justify-center">
                <SunMedium className="h-4 w-4" />
              </div>
              <span className="font-semibold text-xs text-slate-800">Compensatory Off</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Comp-Off</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-500 text-[11px]">Available</span>
              <p className="font-bold text-slate-700 font-mono text-sm">
                {formatNum(compQuota.remaining)}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">Booked</span>
              <p className="font-bold text-slate-700 font-mono text-sm">
                {formatNum(compQuota.taken)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
