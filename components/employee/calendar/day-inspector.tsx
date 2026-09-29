"use client";

import { CalendarDays, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HolidayItem, LeaveItem, formatFullDate } from "./types";

interface DayInspectorProps {
  selectedDateStr: string;
  holiday?: HolidayItem;
  leave?: LeaveItem;
  isWeekend: boolean;
}

export function DayInspector({
  selectedDateStr,
  holiday,
  leave,
  isWeekend,
}: DayInspectorProps) {
  return (
    <Card className="border-slate-200 shadow-soft">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-navy flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand" />
            Day Inspector
          </CardTitle>
          <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            {selectedDateStr}
          </span>
        </div>
        <CardDescription className="text-xs text-slate-500" suppressHydrationWarning>
          {formatFullDate(selectedDateStr)}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Company Holiday */}
        {holiday && (
          <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-start gap-2">
              <span className="text-lg">🎉</span>
              <div>
                <p className="text-xs font-bold text-purple-900">{holiday.title}</p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  {holiday.type === "PUBLIC_HOLIDAY"
                    ? "Official Public Holiday"
                    : "Company Recognized Holiday"}
                </p>
                {holiday.description && (
                  <p className="text-[11px] text-purple-600 italic mt-0.5">
                    {holiday.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Employee Leave */}
        {leave && (
          <div
            className={`p-2.5 rounded-lg border ${
              leave.status === "PENDING"
                ? "bg-amber-50 border-amber-200"
                : "bg-sky-50 border-sky-200"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">🏖️</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <p
                    className={`text-xs font-bold ${
                      leave.status === "PENDING" ? "text-amber-900" : "text-sky-900"
                    }`}
                  >
                    {leave.leaveType} ({leave.days} day)
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 uppercase font-semibold ${
                      leave.status === "PENDING"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-sky-100 text-sky-800 border-sky-300"
                    }`}
                  >
                    {leave.status}
                  </Badge>
                </div>
                <p
                  className={`text-[11px] mt-0.5 ${
                    leave.status === "PENDING" ? "text-amber-700" : "text-sky-700"
                  }`}
                >
                  Reason: {leave.reason}{" "}
                  {leave.session && `(${leave.session})`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Regular Working Day / Weekend */}
        {!holiday && !leave && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-slate-500 shrink-0" />
            <span>
              {isWeekend ? "Weekend (Non-Working Day)" : "Regular Working Day"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
