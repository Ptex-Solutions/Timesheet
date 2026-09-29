"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/shared/topbar";
import { Button } from "@/components/ui/button";
import {
  INITIAL_HOLIDAYS,
  INITIAL_LEAVES,
  INITIAL_QUOTA,
  HolidayItem,
  LeaveItem,
  LeaveQuota,
  formatNum,
  CalendarMetrics,
  CalendarGrid,
  DayInspector,
  ZohoQuotaCard,
} from "@/components/employee/calendar";
import { syncEmployeeLeaves } from "./actions";

export default function EmployeeCalendarPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "Employee";

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    today.toISOString().split("T")[0]
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("Pending Sync");

  const [holidays, setHolidays] = useState<HolidayItem[]>(INITIAL_HOLIDAYS);
  const [leaves, setLeaves] = useState<LeaveItem[]>(INITIAL_LEAVES);
  const [quota, setQuota] = useState<LeaveQuota[]>(INITIAL_QUOTA);

  // Auto-sync dynamically on mount
  useEffect(() => {
    handleSync();
  }, []);

  // Month navigation handlers
  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleToday() {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setSelectedDateStr(d.toISOString().split("T")[0]);
  }

  // Single Sync Button Action dynamically fetching from Zoho Server Action
  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await syncEmployeeLeaves();
      if (res.success) {
        setHolidays(res.holidays);
        setLeaves(res.leaves);
        setQuota(res.quota);

        const now = new Date();
        const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        setLastSyncedAt(`Today at ${nowStr} (Zoho Live)`);
        toast.success(`Successfully synchronized ${res.leaves.length} approved leaves for ${res.userName} (${res.employeeCode}) from Zoho.`);
      } else {
        toast.error(res.message || "Failed to sync leaves from Zoho.");
      }
    } catch {
      toast.error("Failed to sync holiday and leave data from Zoho.");
    } finally {
      setIsSyncing(false);
    }
  }

  // Aggregated totals directly from synced Zoho quota & leaves
  const totalTaken = useMemo(() => {
    const fromQuota = quota.reduce((acc, q) => acc + q.taken, 0);
    if (fromQuota > 0) return fromQuota;
    return leaves.filter((l) => l.status === "APPROVED").reduce((acc, l) => acc + l.days, 0);
  }, [quota, leaves]);

  const totalBalance = useMemo(() => {
    return quota.reduce((acc, q) => acc + q.remaining, 0);
  }, [quota]);

  const totalPending = useMemo(() => {
    const fromQuota = quota.reduce((acc, q) => acc + q.pending, 0);
    if (fromQuota > 0) return fromQuota;
    return leaves.filter((l) => l.status === "PENDING").reduce((acc, l) => acc + l.days, 0);
  }, [quota, leaves]);

  const totalQuota = useMemo(() => totalTaken + totalBalance, [totalTaken, totalBalance]);
  const approvedLeavesCount = useMemo(
    () => leaves.filter((l) => l.status === "APPROVED").length,
    [leaves]
  );

  // Selected Date details
  const selectedDayInfo = useMemo(() => {
    const holiday = holidays.find((h) => h.date === selectedDateStr);
    const leave = leaves.find((l) => l.date === selectedDateStr);
    const dateObj = new Date(selectedDateStr + "T00:00:00");
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      dateStr: selectedDateStr,
      holiday,
      leave,
      isWeekend,
    };
  }, [selectedDateStr, holidays, leaves]);

  return (
    <>
      <Topbar
        title="Calendar & Leave View"
        subtitle="View company holidays, full year leaves (past & future), and timesheet logging availability."
      />

      <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto w-full">
        {/* Page Header with Zoho Status & Single Sync Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-navy tracking-tight">
              Holiday & Leave Calendar
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                • Synced: {lastSyncedAt}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size="sm"
              className="gap-2 bg-brand hover:bg-brand/90 text-white font-medium shadow-sm transition"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing with Zoho..." : "Sync Holidays & Leaves"}
            </Button>
          </div>
        </div>

        {/* 1. Leave Summary Metrics */}
        <CalendarMetrics
          totalBalance={totalBalance}
          totalQuota={totalQuota}
          totalTaken={totalTaken}
          totalPending={totalPending}
          totalHolidays={holidays.length}
          takenCount={approvedLeavesCount}
          currentYear={currentYear}
        />

        {/* 2. Main Calendar & Inspector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Calendar Grid */}
          <CalendarGrid
            currentYear={currentYear}
            currentMonth={currentMonth}
            selectedDateStr={selectedDateStr}
            todayDateStr={today.toISOString().split("T")[0]}
            holidays={holidays}
            leaves={leaves}
            onSelectDate={setSelectedDateStr}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
          />

          {/* Right Column Details */}
          <div className="lg:col-span-4 space-y-4">
            <DayInspector
              selectedDateStr={selectedDayInfo.dateStr}
              holiday={selectedDayInfo.holiday}
              leave={selectedDayInfo.leave}
              isWeekend={selectedDayInfo.isWeekend}
            />

            <ZohoQuotaCard quota={quota} currentYear={currentYear} />
          </div>
        </div>
      </div>
    </>
  );
}
