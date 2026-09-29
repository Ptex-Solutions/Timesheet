"use client";

import { Palmtree, CheckCircle2, Clock, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNum } from "./types";

interface CalendarMetricsProps {
  totalBalance: number;
  totalQuota: number;
  totalTaken: number;
  totalPending: number;
  totalHolidays: number;
  takenCount: number;
  currentYear: number;
}

export function CalendarMetrics({
  totalBalance,
  totalQuota,
  totalTaken,
  totalPending,
  totalHolidays,
  takenCount,
  currentYear,
}: CalendarMetricsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Available Leaves */}
      <Card className="border-slate-200 shadow-soft">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Available Leaves
            </p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-emerald-600 tabular-nums">
              {formatNum(totalBalance)}
              <span className="text-xs font-normal text-slate-400 ml-1">
                / {formatNum(totalQuota)} days
              </span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Remaining balance</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Palmtree className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Booked Leaves */}
      <Card className="border-slate-200 shadow-soft">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Booked Leaves
            </p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-sky-600 tabular-nums">
              {formatNum(totalTaken)}
              <span className="text-xs font-normal text-slate-400 ml-1">day(s)</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Taken this year ({takenCount} entries)
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Pending Leaves */}
      <Card className="border-slate-200 shadow-soft">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Leaves
            </p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-amber-600 tabular-nums">
              {formatNum(totalPending)}
              <span className="text-xs font-normal text-slate-400 ml-1">days</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Awaiting approval</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Total Holidays */}
      <Card className="border-slate-200 shadow-soft">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Holidays
            </p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-purple-600 tabular-nums">
              {totalHolidays}
              <span className="text-xs font-normal text-slate-400 ml-1">days</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Company & public in {currentYear}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
