"use client";

// Weekdays only: no time can be logged on weekends.
const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
const LABELS = ["MON", "TUE", "WED", "THU", "FRI"];

export function WeeklyGrid({
  rows,
}: {
  rows: Array<{
    sat: number; sun: number; mon: number; tue: number; wed: number; thu: number; fri: number;
  }>;
}) {
  const totals = DAYS.map((d) => rows.reduce((s, r) => s + Number((r as any)[d] ?? 0), 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const max = Math.max(8, ...totals);

  return (
    <div className="grid grid-cols-5 gap-2">
      {LABELS.map((label, i) => {
        const v = totals[i];
        const pct = Math.min(100, (v / max) * 100);
        return (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col items-center justify-between min-h-[110px] shadow-soft"
          >
            <p className={`text-[10px] font-bold tracking-widest text-slate-600`}>{label}</p>
            <p className="text-2xl font-display font-bold text-navy tabular-nums my-1">{v.toFixed(1)}</p>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-gradient" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="col-span-5 flex items-center justify-between mt-2 px-1">
        <span className="text-xs text-slate-500">Weekly total</span>
        <span className="text-sm font-bold text-navy tabular-nums">{grand.toFixed(2)} hrs</span>
      </div>
    </div>
  );
}
