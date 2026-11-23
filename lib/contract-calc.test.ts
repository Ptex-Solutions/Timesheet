import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeContractTotals,
  formatMoney,
  formatScaled,
  isValidDecimal2,
  toHundredths,
  validateContractGrid,
} from "./contract-calc";

const TC = 1, BC = 2, LC = 3;
const DEV = 10, TEST = 11, DEPLOY = 12;

test("toHundredths parses 2dp decimals exactly and rejects the rest", () => {
  assert.equal(toHundredths("100"), BigInt(10000));
  assert.equal(toHundredths("0.1"), BigInt(10));
  assert.equal(toHundredths("12.34"), BigInt(1234));
  assert.equal(toHundredths(7.5), BigInt(750));
  assert.equal(toHundredths(" 3 "), BigInt(300));
  for (const bad of ["-1", "1.234", "abc", "", "1e3", "1.", ".5", "12345678901", -2, NaN, Infinity]) {
    assert.equal(toHundredths(bad as never), null, `expected ${String(bad)} to be rejected`);
  }
  assert.equal(isValidDecimal2("0"), true);
});

test("formatScaled rounds 1/10000 half-up to 2 decimals", () => {
  assert.equal(formatScaled(BigInt(123456), 4), "12.35"); // 12.3456
  assert.equal(formatScaled(BigInt(123449), 4), "12.34");
  assert.equal(formatScaled(BigInt(5), 2), "0.05");
});

test("spec example: per-task, per-role and contract totals", () => {
  const t = computeContractTotals({
    rates: [
      { resourceTypeId: TC, ratePerHour: "100" },
      { resourceTypeId: BC, ratePerHour: "200" },
      { resourceTypeId: LC, ratePerHour: "500" },
    ],
    tasks: [
      { taskMasterId: DEV, hours: { [TC]: "10", [BC]: "20", [LC]: "0" } },
      { taskMasterId: TEST, hours: { [TC]: "20", [BC]: "10" } },
      { taskMasterId: DEPLOY, hours: { [LC]: "20" } },
    ],
  });
  assert.deepEqual(t.taskTotals.map((x) => x.hours), ["30.00", "30.00", "20.00"]);
  assert.deepEqual(t.roleTotals, [
    { resourceTypeId: TC, hours: "30.00", amount: "3000.00" },
    { resourceTypeId: BC, hours: "30.00", amount: "6000.00" },
    { resourceTypeId: LC, hours: "20.00", amount: "10000.00" },
  ]);
  assert.equal(t.totalHours, "80.00");
  assert.equal(t.totalAmount, "19000.00");
});

test("no floating-point drift: 0.1h x 0.2 rate summed many times", () => {
  const tasks = Array.from({ length: 30 }, (_, i) => ({ taskMasterId: i + 1, hours: { [TC]: "0.1" } }));
  const t = computeContractTotals({ rates: [{ resourceTypeId: TC, ratePerHour: "0.2" }], tasks });
  assert.equal(t.totalHours, "3.00");
  // 3.00h x 0.20 = 0.60 exactly (0.1 * 0.2 * 30 in floats is 0.6000000000000001)
  assert.equal(t.totalAmount, "0.60");
});

test("total amount is rounded once from exact products, not summed from rounded ones", () => {
  // 0.35h x 0.15 = 0.0525 per role, which rounds to 0.05; three roles summed
  // exactly = 0.1575 -> 0.16, whereas summing rounded amounts would give 0.15.
  const rates = [TC, BC, LC].map((id) => ({ resourceTypeId: id, ratePerHour: "0.15" }));
  const t = computeContractTotals({
    rates,
    tasks: [{ taskMasterId: DEV, hours: { [TC]: "0.35", [BC]: "0.35", [LC]: "0.35" } }],
  });
  assert.deepEqual(t.roleTotals.map((r) => r.amount), ["0.05", "0.05", "0.05"]);
  assert.equal(t.totalAmount, "0.16");
});

test("blank or invalid cells preview as zero; hours for removed roles are ignored", () => {
  const t = computeContractTotals({
    rates: [{ resourceTypeId: TC, ratePerHour: "50" }],
    tasks: [{ taskMasterId: DEV, hours: { [TC]: "", [BC]: "99" } }],
  });
  assert.equal(t.totalHours, "0.00");
  assert.equal(t.totalAmount, "0.00");
});

test("validateContractGrid flags duplicates, bad numbers and orphan role hours", () => {
  const errors = validateContractGrid({
    rates: [
      { resourceTypeId: TC, ratePerHour: "100" },
      { resourceTypeId: TC, ratePerHour: "-5" },
    ],
    tasks: [
      { taskMasterId: DEV, hours: { [TC]: "1.234" } },
      { taskMasterId: DEV, hours: { [LC]: "5" } },
    ],
  });
  assert.equal(errors.length, 5);
  assert.match(errors.join("\n"), /Duplicate role/);
  assert.match(errors.join("\n"), /Duplicate task/);
  assert.match(errors.join("\n"), /no rate/);
  assert.deepEqual(
    validateContractGrid({
      rates: [{ resourceTypeId: TC, ratePerHour: "100.5" }],
      tasks: [{ taskMasterId: DEV, hours: { [TC]: "8" } }],
    }),
    []
  );
});

test("formatMoney groups thousands and appends the currency code", () => {
  assert.equal(formatMoney("19000.00", "GBP"), "19,000.00 GBP");
  assert.equal(formatMoney("1234567.5"), "1,234,567.5");
  assert.equal(formatMoney("0.00"), "0.00");
});
