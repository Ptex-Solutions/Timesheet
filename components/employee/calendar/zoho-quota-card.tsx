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
        {quota.map((q) => {
          const percentage = q.total > 0 ? (q.taken / q.total) * 100 : 0;
          const isPL = q.type === "Privilege Leave";
          const code = isPL ? "PL" : q.type === "Compensatory Off" ? "Comp-Off" : q.type;

          return (
            <div
              key={q.type}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      isPL ? "bg-sky-100 text-sky-600" : "bg-lime-100 text-lime-700"
                    }`}
                  >
                    <SunMedium className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-xs text-slate-800">{q.type}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{code}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Available</span>
                  <p className="font-bold text-emerald-600 font-mono text-sm">
                    {formatNum(q.remaining)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Booked</span>
                  <p className="font-bold text-slate-800 font-mono text-sm">
                    {formatNum(q.taken)}
                  </p>
                </div>
              </div>
              <Progress value={percentage} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
