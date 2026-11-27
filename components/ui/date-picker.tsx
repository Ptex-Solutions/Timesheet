"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type Matcher } from "react-day-picker";
import { format, isValid, parse } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Value is a local calendar date "YYYY-MM-DD" (same as <input type="date">).
const toDate = (iso: string) => {
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
};
const toIso = (d: Date) => format(d, "yyyy-MM-dd");

export function DatePicker({
  value,
  onChange,
  max,
  min,
  disableWeekends,
  disabled,
  placeholder = "Pick a date",
  className,
  size = "md",
}: {
  value: string;
  onChange: (iso: string) => void;
  max?: string;
  min?: string;
  disableWeekends?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);
  const maxDate = max ? toDate(max) : undefined;
  const minDate = min ? toDate(min) : undefined;

  const blocked: Matcher[] = [];
  if (disableWeekends) blocked.push({ dayOfWeek: [0, 6] });
  if (maxDate) blocked.push({ after: maxDate });
  if (minDate) blocked.push({ before: minDate });

  const today = new Date();
  const todayBlocked =
    (disableWeekends && (today.getDay() === 0 || today.getDay() === 6)) ||
    (maxDate && toIso(today) > toIso(maxDate)) ||
    (minDate && toIso(today) < toIso(minDate));

  const pick = (d: Date | undefined) => {
    if (!d) return;
    onChange(toIso(d));
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "group inline-flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white text-left shadow-sm transition-colors",
            "hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200",
            "data-[state=open]:border-brand-400 data-[state=open]:ring-2 data-[state=open]:ring-brand-100",
            "disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
            className
          )}
        >
          <CalendarDays
            className={cn(
              "shrink-0 text-slate-400 transition-colors group-hover:text-brand group-data-[state=open]:text-brand",
              size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
            )}
          />
          {selected ? (
            <span className="truncate tabular-nums text-navy">
              <span className="font-semibold">{format(selected, "EEE")}</span>
              <span className="text-slate-500">, {format(selected, "d MMM yyyy")}</span>
            </span>
          ) : (
            <span className="truncate text-slate-400">{placeholder}</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[296px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {/* Accent strip with the selected date */}
          <div className="bg-brand-gradient px-4 py-3 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">Selected date</p>
            <p className="font-display text-lg font-bold leading-tight">
              {selected ? format(selected, "EEEE, d MMMM") : "None yet"}
            </p>
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={pick}
            defaultMonth={selected ?? maxDate ?? today}
            disabled={blocked}
            toDate={maxDate}
            fromDate={minDate}
            weekStartsOn={1}
            showOutsideDays
            fixedWeeks
            className="p-3"
            classNames={{
              months: "flex flex-col",
              month: "space-y-2",
              caption: "relative flex h-9 items-center justify-center",
              caption_label: "font-display text-sm font-semibold text-navy",
              nav: "flex items-center",
              nav_button:
                "inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand disabled:pointer-events-none disabled:opacity-30",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "w-9 flex-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400",
              row: "mt-1 flex w-full",
              cell: "flex-1 p-0 text-center",
              day: "mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm tabular-nums text-navy transition-colors hover:bg-brand-50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200",
              // `!` because `day` sets its own text/hover colours; bg-brand-gradient is
              // plain CSS (globals.css), so it has no `!` variant — use utilities.
              day_selected:
                "!bg-brand !text-white font-semibold shadow-brand ring-0 hover:!bg-brand-600 hover:!text-white",
              day_today: "font-bold text-brand ring-1 ring-inset ring-brand-200",
              day_outside: "text-slate-300",
              day_disabled: "pointer-events-none text-slate-300 line-through decoration-slate-200",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => <ChevronLeft className="h-4 w-4" />,
              IconRight: () => <ChevronRight className="h-4 w-4" />,
            }}
          />
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
            <span className="text-[11px] text-slate-400">{disableWeekends ? "Weekends unavailable" : ""}</span>
            <button
              type="button"
              disabled={!!todayBlocked}
              onClick={() => pick(today)}
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40"
            >
              Today
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
