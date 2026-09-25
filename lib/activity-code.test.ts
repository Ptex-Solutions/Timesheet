import { test } from "node:test";
import assert from "node:assert/strict";
import { buildActivityId } from "./activity-code";

test("buildActivityId joins segments with '.'", () => {
  const id = buildActivityId({
    clientCode: "STC",
    moduleCode: "ALL",
    typeCode: "CR",
    versionCode: "1.0",
    seq: 4390,
  });
  assert.equal(id, "STC.ALL.CR.1.0.4390");
});

test("buildActivityId uppercases each code segment", () => {
  const id = buildActivityId({
    clientCode: "stc",
    moduleCode: "all",
    typeCode: "cr",
    versionCode: "na",
    seq: 1,
  });
  assert.equal(id, "STC.ALL.CR.NA.1");
});

test("version segments like '1.0' pass through unchanged (not split further)", () => {
  const id = buildActivityId({
    clientCode: "STC",
    moduleCode: "ALL",
    typeCode: "CR",
    versionCode: "1.0",
    seq: 4391,
  });
  assert.equal(id, "STC.ALL.CR.1.0.4391");
  // exactly one occurrence of "1.0" preserved verbatim (not "1.0.0" or "10")
  assert.equal(id.split(".").slice(3, 5).join("."), "1.0");
});

test("version 'NA' passes through unchanged", () => {
  const id = buildActivityId({
    clientCode: "INT",
    moduleCode: "ALL",
    typeCode: "BAU",
    versionCode: "NA",
    seq: 4393,
  });
  assert.equal(id, "INT.ALL.BAU.NA.4393");
});

test("version '8.0' works", () => {
  const id = buildActivityId({
    clientCode: "STC",
    moduleCode: "ALL",
    typeCode: "SUP",
    versionCode: "8.0",
    seq: 4392,
  });
  assert.equal(id, "STC.ALL.SUP.8.0.4392");
});

test("seq stays numeric, not uppercased/altered", () => {
  const id = buildActivityId({
    clientCode: "STC",
    moduleCode: "ALL",
    typeCode: "CR",
    versionCode: "1.0",
    seq: 4390,
  });
  assert.ok(id.endsWith(".4390"));
});
