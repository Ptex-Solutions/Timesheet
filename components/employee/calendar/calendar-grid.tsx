"use client";

import { useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  HolidayItem,
  LeaveItem,
  MONTH_NAMES,
  WEEKDAY_NAMES,
} from "./types";

interface CalendarGridProps {
  currentYear: number;
  currentMonth: number;
  selectedDateStr: string;
  todayDateStr: string;
  holidays: HolidayItem[];
  leaves: LeaveItem[];
  onSelectDate: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function CalendarGrid({
  currentYear,
  currentMonth,
  selectedDateStr,
  todayDateStr,
  holidays,
  leaves,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarGridProps) {
  // Generate grid days for current month view
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDayIndex = firstDay.getDay(); // 0 is Sunday
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Previous month trailing days
    const prevMonthDaysCount = new Date(currentYear, currentMonth, 0).getDate();
    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      holiday?: HolidayItem;
      leave?: LeaveItem;
    }[] = [];

    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDaysCount - i;
      const monthNum = currentMonth === 0 ? 12 : currentMonth;
      const yearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const dayOfWeek = new Date(yearNum, monthNum - 1, dayNum).getDay();
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        holiday: holidays.find((h) => h.date === dateStr),
        leave: leaves.find((l) => l.date === dateStr),
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const dayOfWeek = new Date(currentYear, currentMonth, dayNum).getDay();
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        holiday: holidays.find((h) => h.date === dateStr),
        leave: leaves.find((l) => l.date === dateStr),
      });
    }

    // Next month leading days to complete grid (multiples of 7)
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
      const monthNum = currentMonth === 11 ? 1 : currentMonth + 2;
      const yearNum = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const dayOfWeek = new Date(yearNum, monthNum - 1, dayNum).getDay();
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        holiday: holidays.find((h) => h.date === dateStr),
        leave: leaves.find((l) => l.date === dateStr),
      });
    }

    return days;
  }, [currentYear, currentMonth, holidays, leaves]);

  return (
    <Card className="lg:col-span-8 border-slate-200 shadow-soft">
      <CardHeader className="py-3.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-navy/5 text-navy flex items-center justify-center">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-navy leading-tight">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Click any day to inspect details and timesheet eligibility
            </CardDescription>
          </div>
        </div>

        {/* Month navigation buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="h-8 px-2.5 text-xs text-slate-700"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevMonth}
            className="h-8 w-8 text-slate-600"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextMonth}
            className="h-8 w-8 text-slate-600"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
          {WEEKDAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`text-xs font-semibold py-1 ${
                i === 0 || i === 6 ? "text-slate-400 font-medium" : "text-slate-700"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Compact Date Cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const isSelected = day.dateStr === selectedDateStr;
            const isToday = day.dateStr === todayDateStr;
            const hasHoliday = Boolean(day.holiday);
            const hasLeave = Boolean(day.leave);

            return (
              <button
                key={day.dateStr}
                onClick={() => onSelectDate(day.dateStr)}
                className={`min-h-[52px] sm:min-h-[56px] p-1.5 rounded-lg border text-left flex flex-col justify-between transition relative overflow-hidden group ${
                  !day.isCurrentMonth
                    ? "bg-slate-50/40 border-transparent text-slate-300 opacity-50"
                    : isSelected
                    ? "bg-brand/5 border-brand ring-2 ring-brand/20 text-navy shadow-xs z-10"
                    : hasHoliday
                    ? "bg-purple-50/70 border-purple-200 text-purple-900 hover:bg-purple-50"
                    : hasLeave
                    ? day.leave?.status === "PENDING"
                      ? "bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-50"
                      : "bg-sky-50/70 border-sky-200 text-sky-900 hover:bg-sky-50"
                    : day.isWeekend
                    ? "bg-slate-50/70 border-slate-150 text-slate-500 hover:bg-slate-100/60"
                    : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                {/* Top row: day number + indicators */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-semibold inline-flex items-center justify-center rounded ${
                      isToday
                        ? "bg-navy text-white h-5 min-w-[20px] px-1 shadow-xs"
                        : isSelected
                        ? "text-brand font-bold"
                        : ""
                    }`}
                  >
                    {day.dayNum}
                  </span>

                  {/* Status Icon Dot */}
                  {hasHoliday && (
                    <span
                      className="h-2 w-2 rounded-full bg-purple-500 ring-2 ring-white shrink-0"
                      title={day.holiday?.title}
                    />
                  )}
                  {!hasHoliday && hasLeave && (
                    <span
                      className={`h-2 w-2 rounded-full ring-2 ring-white shrink-0 ${
                        day.leave?.status === "PENDING" ? "bg-amber-500" : "bg-sky-500"
                      }`}
                      title={`${day.leave?.leaveType} (${day.leave?.days}d)`}
                    />
                  )}
                </div>

                {/* Bottom row / Compact Label */}
                <div className="w-full mt-1 truncate">
                  {hasHoliday && (
                    <div className="text-[10px] leading-tight font-medium text-purple-700 truncate bg-purple-100/80 px-1 py-0.5 rounded">
                      🎉 {day.holiday?.title}
                    </div>
                  )}
                  {!hasHoliday && hasLeave && (
                    <div
                      className={`text-[10px] leading-tight font-medium truncate px-1 py-0.5 rounded ${
                        day.leave?.status === "PENDING"
                          ? "text-amber-800 bg-amber-100/80"
                          : "text-sky-800 bg-sky-100/80"
                      }`}
                    >
                      🏖️ {day.leave && day.leave.days < 1 ? `0.5d PL` : `PL`}
                      {day.leave?.status === "PENDING" && " (P)"}
                    </div>
                  )}
                  {!hasHoliday && !hasLeave && <div className="h-3" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
            <span>Company Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span>Privilege Leave (Booked)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Pending Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span>Weekend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-navy" />
            <span>Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
