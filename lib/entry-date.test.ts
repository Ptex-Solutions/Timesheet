import { test } from "node:test";
import assert from "node:assert/strict";
import { dayCapError, defaultEntryDate, isWeekend, localTodayIso, nextDayIso } from "./entry-date";

const TODAY = "2026-10-01";

test("no entries → today", () => {
  assert.equal(defaultEntryDate([], TODAY), TODAY);
});

test("last entry date under 8h → same date", () => {
  // Monday 28 Sept has 4h logged.
  assert.equal(defaultEntryDate([{ date: "2026-09-28", hours: 4 }], TODAY), "2026-09-28");
});

test("last entry date at 8h → next day", () => {
  const entries = [
    { date: "2026-09-28", hours: 4 },
    { date: "2026-09-28", hours: 4 },
  ];
  assert.equal(defaultEntryDate(entries, TODAY), "2026-09-29");
});

test("over 8h also moves to the next day", () => {
  assert.equal(defaultEntryDate([{ date: "2026-09-28", hours: 9.5 }], TODAY), "2026-09-29");
});

test("uses the latest date, not the most recently added entry", () => {
  const entries = [
    { date: "2026-09-29", hours: 2 },
    { date: "2026-09-25", hours: 8 },
  ];
  assert.equal(defaultEntryDate(entries, TODAY), "2026-09-29");
});

test("unsaved rows count toward the day's total", () => {
  // Saved 5h + a pending row with 3h on the same date.
  const entries = [
    { date: "2026-09-28", hours: 5 },
    { date: "2026-09-28", hours: 3 },
  ];
  assert.equal(defaultEntryDate(entries, TODAY), "2026-09-29");
});

test("blank or invalid hours count as 0; blank dates are ignored", () => {
  const entries = [
    { date: "2026-09-28", hours: Number("") },
    { date: "2026-09-28", hours: Number.NaN },
    { date: "", hours: 8 },
  ];
  assert.equal(defaultEntryDate(entries, TODAY), "2026-09-28");
});

test("next day crosses month and year boundaries", () => {
  assert.equal(nextDayIso("2026-09-30"), "2026-10-01");
  assert.equal(nextDayIso("2026-12-31"), "2027-01-01");
});

test("localTodayIso uses the local calendar date", () => {
  assert.equal(localTodayIso(new Date(2026, 8, 28, 1, 30)), "2026-09-28");
});

test("dayCapError allows up to MAX_DAY_HOURS per day and explains the rest", () => {
  assert.equal(dayCapError(0, 10), null);
  assert.equal(dayCapError(9.5, 0.5), null);
  assert.equal(dayCapError(0.1 + 0.2, 9.7), null); // float sum 10.000000000000002
  assert.match(dayCapError(0, 10.5)!, /at most 10h/);
  assert.match(dayCapError(7.5, 3)!, /at most 2\.5h/);
  assert.match(dayCapError(10, 0.5)!, /already logged 10h/);
});

test("weekends are blocked and the default date skips them", () => {
  assert.equal(isWeekend(new Date("2026-11-28")), true); // Saturday
  assert.equal(isWeekend(new Date("2026-11-29")), true); // Sunday
  assert.equal(isWeekend(new Date("2026-11-30")), false); // Monday
  assert.equal(isWeekend(new Date("2026-11-27")), false); // Friday
  // Friday full → Monday, not Saturday.
  assert.equal(defaultEntryDate([{ date: "2026-11-27", hours: 8 }], "2026-11-30"), "2026-11-30");
  // Never in the future: Sunday with nothing logged → Friday.
  assert.equal(defaultEntryDate([], "2026-11-29"), "2026-11-27");
});
