import { test } from "node:test";
import assert from "node:assert/strict";
import { MasterType } from "@prisma/client";
import { ACTIVITY_MASTER_TYPES, MASTER_TYPE_LABEL, MASTER_TYPE_OPTIONS } from "./master-types";

test("UI master type list mirrors the Prisma MasterType enum exactly", () => {
  assert.deepEqual(
    MASTER_TYPE_OPTIONS.map((o) => o.value).sort(),
    Object.values(MasterType).sort()
  );
});

test("Season 2 contract master types are present with labels", () => {
  assert.equal(MASTER_TYPE_LABEL.CURRENCY, "Currency");
  assert.equal(MASTER_TYPE_LABEL.RESOURCE_TYPE, "Resource Type");
  assert.equal(MASTER_TYPE_LABEL.TASK, "Tasks");
});

test("Activity master types exclude contract-only categories", () => {
  for (const t of ["CURRENCY", "RESOURCE_TYPE", "TASK"]) {
    assert.ok(!(ACTIVITY_MASTER_TYPES as readonly string[]).includes(t));
  }
  assert.equal(ACTIVITY_MASTER_TYPES.length, 6);
});
