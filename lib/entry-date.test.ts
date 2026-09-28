import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultEntryDate, localTodayIso, nextDayIso } from "./entry-date";

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
