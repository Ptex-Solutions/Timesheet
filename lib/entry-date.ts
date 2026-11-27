// Default date for a new timesheet row. Pure (no prisma/next) so it can be
// unit-tested and used in client components.

// A day counts as "complete" once it has this many hours logged.
export const FULL_DAY_HOURS = 8;

// Hard cap: an employee can't log more than this per calendar day (all
// entries of the day together, whatever their status).
export const MAX_DAY_HOURS = 10;

// Error message when adding `adding` hours to a day that already has `logged`
// hours would pass MAX_DAY_HOURS; null when it fits. Compared in hundredths so
// float sums like 9.5 + 0.5 can't drift past the cap.
export function dayCapError(logged: number, adding: number): string | null {
  if (Math.round((logged + adding) * 100) <= MAX_DAY_HOURS * 100) return null;
  const left = Math.max(0, Math.round((MAX_DAY_HOURS - logged) * 100) / 100);
  return left === 0
    ? `You have already logged ${MAX_DAY_HOURS}h on this day, the maximum allowed per day`
    : `You can log at most ${MAX_DAY_HOURS}h per day. ${logged}h is already logged on this day, so this entry can be at most ${left}h`;
}

export type DatedHours = { date: string; hours: number }; // date = YYYY-MM-DD

// Local calendar date. toISOString would give the UTC date, i.e. yesterday in
// IST before 05:30.
export function localTodayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// No time can be logged on Saturdays or Sundays. Takes the stored form of an
// entry date: `new Date("YYYY-MM-DD")`, i.e. UTC midnight of that day.
export const WEEKEND_ERROR = "Time can't be logged on Saturdays or Sundays";
export function isWeekend(date: Date): boolean {
  return date.getUTCDay() % 6 === 0;
}

// No time can be logged for days after today (local calendar date).
export const FUTURE_ERROR = "Time can't be logged for future dates";
export function isFuture(date: Date, now: Date = new Date()): boolean {
  return date.toISOString().slice(0, 10) > localTodayIso(now);
}

// The same date, or the nearest weekday in direction `step` (+1 / -1).
function skipWeekend(iso: string, step = 1): string {
  while (isWeekend(new Date(`${iso}T00:00:00Z`))) iso = nextDayIso(iso, step);
  return iso;
}

export function nextDayIso(iso: string, step = 1): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + step);
  return d.toISOString().slice(0, 10);
}

// The latest date that has entries, or the day after it once that date has
// FULL_DAY_HOURS or more. No entries → today. A weekend moves to Monday, but
// never past today: then it falls back to the last weekday up to today.
export function defaultEntryDate(entries: DatedHours[], today: string): string {
  const hoursByDate = new Map<string, number>();
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const h = Number.isFinite(e.hours) ? e.hours : 0;
    hoursByDate.set(e.date, (hoursByDate.get(e.date) ?? 0) + h);
  }
  const latest = [...hoursByDate.keys()].sort().at(-1);
  const pick = skipWeekend(
    latest === undefined ? today : (hoursByDate.get(latest) ?? 0) >= FULL_DAY_HOURS ? nextDayIso(latest) : latest
  );
  return pick > today ? skipWeekend(today, -1) : pick;
}
