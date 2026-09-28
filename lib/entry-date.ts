// Default date for a new timesheet row. Pure (no prisma/next) so it can be
// unit-tested and used in client components.

// A day counts as "complete" once it has this many hours logged.
export const FULL_DAY_HOURS = 8;

export type DatedHours = { date: string; hours: number }; // date = YYYY-MM-DD

// Local calendar date. toISOString would give the UTC date, i.e. yesterday in
// IST before 05:30.
export function localTodayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function nextDayIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// The latest date that has entries, or the day after it once that date has
// FULL_DAY_HOURS or more. No entries → today.
export function defaultEntryDate(entries: DatedHours[], today: string): string {
  const hoursByDate = new Map<string, number>();
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const h = Number.isFinite(e.hours) ? e.hours : 0;
    hoursByDate.set(e.date, (hoursByDate.get(e.date) ?? 0) + h);
  }
  if (hoursByDate.size === 0) return today;
  const latest = [...hoursByDate.keys()].sort().at(-1)!;
  return (hoursByDate.get(latest) ?? 0) >= FULL_DAY_HOURS ? nextDayIso(latest) : latest;
}
