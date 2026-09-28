import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROLES,
  ROLE_RANK,
  ROLE_LABELS,
  STAFF_ROLES,
  isStaffRole,
  MODULES,
  ALL_PERMISSIONS,
  isPermission,
  ACTION_LABELS,
  BASE_ACTIONS,
  roleDefaults,
  resolvePermissions,
  diffOverrides,
  canManageRole,
  canEditAccess,
  hasPermission,
  type Permission,
  type PermissionOverride,
} from "./permissions";

// ---------- catalogue sanity ----------

test("ACTION_LABELS and BASE_ACTIONS are as specified", () => {
  assert.deepEqual(BASE_ACTIONS, ["view", "edit", "delete"]);
  assert.equal(ACTION_LABELS.view, "View");
  assert.equal(ACTION_LABELS.edit, "Edit");
  assert.equal(ACTION_LABELS.delete, "Delete");
  assert.equal(ACTION_LABELS.approve, "Approve");
  assert.equal(ACTION_LABELS.reopen, "Re-open");
  assert.equal(ACTION_LABELS.finalize, "Finalize");
});

test("MODULES catalogue order and contents", () => {
  const keys = MODULES.map((m) => m.key);
  assert.deepEqual(keys, ["timesheets", "mis", "clients", "sandbox", "employees", "access"]);

  const timesheets = MODULES.find((m) => m.key === "timesheets")!;
  assert.deepEqual(timesheets.actions, ["view", "edit", "delete", "approve", "reopen"]);

  const mis = MODULES.find((m) => m.key === "mis")!;
  assert.deepEqual(mis.actions, ["view", "edit", "delete", "finalize"]);

  const access = MODULES.find((m) => m.key === "access")!;
  assert.deepEqual(access.actions, ["view", "edit"]);
});

test("Permission type distributes per module (compile-time guard)", () => {
  const valid: Permission = "sandbox.view";
  assert.equal(valid, "sandbox.view");

  // @ts-expect-error "finalize" is not a sandbox action — Permission must not
  // be the cross product of every module's key with every module's actions.
  const invalid1: Permission = "sandbox.finalize";
  // @ts-expect-error "approve" is not an access action.
  const invalid2: Permission = "access.approve";
  void invalid1;
  void invalid2;
});

test("isPermission validates catalogue-derived permissions", () => {
  assert.equal(isPermission("timesheets.approve"), true);
  assert.equal(isPermission("access.edit"), true);
  assert.equal(isPermission("timesheets.finalize"), false);
  assert.equal(isPermission("nonsense"), false);
  assert.equal(isPermission("nonsense.view"), false);
});

// ---------- role defaults ----------

test("EMPLOYEE has no default permissions", () => {
  const perms = roleDefaults("EMPLOYEE");
  assert.equal(perms.size, 0);
});

test("ADMIN has every permission except access.*", () => {
  const perms = roleDefaults("ADMIN");
  for (const p of ALL_PERMISSIONS) {
    if (p.startsWith("access.")) {
      assert.equal(perms.has(p), false, `expected ADMIN to lack ${p}`);
    } else {
      assert.equal(perms.has(p), true, `expected ADMIN to have ${p}`);
    }
  }
});

test("MANAGER has every permission", () => {
  const perms = roleDefaults("MANAGER");
  for (const p of ALL_PERMISSIONS) {
    assert.equal(perms.has(p), true, `expected MANAGER to have ${p}`);
  }
});

test("SUPER_ADMIN has every permission", () => {
  const perms = roleDefaults("SUPER_ADMIN");
  for (const p of ALL_PERMISSIONS) {
    assert.equal(perms.has(p), true, `expected SUPER_ADMIN to have ${p}`);
  }
});

// ---------- overrides ----------

test("grant override adds a permission beyond role defaults (ADMIN + access.view)", () => {
  const overrides: PermissionOverride[] = [{ module: "access", action: "view", granted: true }];
  const perms = resolvePermissions("ADMIN", overrides);
  assert.equal(perms.has("access.view"), true);
  // rest of access module still absent
  assert.equal(perms.has("access.edit"), false);
});

test("revoke override removes a role default (ADMIN - timesheets.delete)", () => {
  const overrides: PermissionOverride[] = [{ module: "timesheets", action: "delete", granted: false }];
  const perms = resolvePermissions("ADMIN", overrides);
  assert.equal(perms.has("timesheets.delete"), false);
  assert.equal(perms.has("timesheets.view"), true);
});

test("SUPER_ADMIN ignores overrides entirely", () => {
  const overrides: PermissionOverride[] = [
    { module: "timesheets", action: "view", granted: false },
    { module: "access", action: "edit", granted: false },
  ];
  const perms = resolvePermissions("SUPER_ADMIN", overrides);
  for (const p of ALL_PERMISSIONS) {
    assert.equal(perms.has(p), true);
  }
});

test("EMPLOYEE ignores overrides entirely", () => {
  const overrides: PermissionOverride[] = [{ module: "timesheets", action: "view", granted: true }];
  const perms = resolvePermissions("EMPLOYEE", overrides);
  assert.equal(perms.size, 0);
});

test("unknown override module/action keys are ignored", () => {
  const overrides: PermissionOverride[] = [
    { module: "bogus", action: "view", granted: true },
    { module: "timesheets", action: "bogus", granted: true },
  ];
  const before = resolvePermissions("ADMIN", []);
  const after = resolvePermissions("ADMIN", overrides);
  assert.deepEqual([...after].sort(), [...before].sort());
});

// ---------- diffOverrides round-trip ----------

test("diffOverrides -> resolvePermissions round trip for ADMIN", () => {
  const defaults = roleDefaults("ADMIN");
  const desired = new Set<Permission>([...defaults]);
  desired.delete("timesheets.delete");
  desired.add("access.view");

  const overrides = diffOverrides("ADMIN", desired);
  const resolved = resolvePermissions("ADMIN", overrides);
  assert.deepEqual([...resolved].sort(), [...desired].sort());
});

test("diffOverrides -> resolvePermissions round trip for MANAGER", () => {
  const defaults = roleDefaults("MANAGER");
  const desired = new Set<Permission>([...defaults]);
  desired.delete("employees.delete");
  desired.delete("access.edit");

  const overrides = diffOverrides("MANAGER", desired);
  const resolved = resolvePermissions("MANAGER", overrides);
  assert.deepEqual([...resolved].sort(), [...desired].sort());
});

test("diffOverrides of exactly the defaults is empty", () => {
  const defaults = roleDefaults("ADMIN");
  const overrides = diffOverrides("ADMIN", defaults);
  assert.deepEqual(overrides, []);

  const adminDefaults = roleDefaults("MANAGER");
  const adminOverrides = diffOverrides("MANAGER", adminDefaults);
  assert.deepEqual(adminOverrides, []);
});

test("diffOverrides produces deterministic catalogue order", () => {
  const defaults = roleDefaults("ADMIN");
  const desired = new Set<Permission>([...defaults]);
  desired.delete("timesheets.view");
  desired.delete("mis.view");
  desired.add("access.edit");
  desired.add("access.view");

  const overrides = diffOverrides("ADMIN", desired);
  // revokes should appear in catalogue order, then grants in catalogue order
  const revokes = overrides.filter((o) => !o.granted).map((o) => `${o.module}.${o.action}`);
  const grants = overrides.filter((o) => o.granted).map((o) => `${o.module}.${o.action}`);
  assert.deepEqual(revokes, ["timesheets.view", "mis.view"]);
  assert.deepEqual(grants, ["access.view", "access.edit"]);
});

// ---------- canManageRole matrix ----------

test("canManageRole 4x4 matrix", () => {
  const expected: Record<string, Record<string, boolean>> = {
    EMPLOYEE: { EMPLOYEE: false, ADMIN: false, MANAGER: false, SUPER_ADMIN: false },
    ADMIN: { EMPLOYEE: true, ADMIN: false, MANAGER: false, SUPER_ADMIN: false },
    MANAGER: { EMPLOYEE: true, ADMIN: true, MANAGER: false, SUPER_ADMIN: false },
    SUPER_ADMIN: { EMPLOYEE: true, ADMIN: true, MANAGER: true, SUPER_ADMIN: true },
  };
  for (const actor of ROLES) {
    for (const target of ROLES) {
      assert.equal(
        canManageRole(actor, target),
        expected[actor][target],
        `canManageRole(${actor}, ${target})`
      );
    }
  }
});

// ---------- canEditAccess ----------

test("canEditAccess: MANAGER with access.edit can edit ADMIN", () => {
  const perms = new Set<Permission>(["access.edit"]);
  assert.equal(canEditAccess("MANAGER", perms, "ADMIN"), true);
});

test("canEditAccess: MANAGER cannot edit MANAGER (equal rank)", () => {
  const perms = new Set<Permission>(["access.edit"]);
  assert.equal(canEditAccess("MANAGER", perms, "MANAGER"), false);
});

test("canEditAccess: SUPER_ADMIN with access.edit can edit MANAGER", () => {
  const perms = new Set<Permission>(["access.edit"]);
  assert.equal(canEditAccess("SUPER_ADMIN", perms, "MANAGER"), true);
});

test("canEditAccess: SUPER_ADMIN cannot edit SUPER_ADMIN (not editable target)", () => {
  const perms = new Set<Permission>(["access.edit"]);
  assert.equal(canEditAccess("SUPER_ADMIN", perms, "SUPER_ADMIN"), false);
});

test("canEditAccess: no role can edit EMPLOYEE target", () => {
  const perms = new Set<Permission>(["access.edit"]);
  for (const actor of ROLES) {
    assert.equal(canEditAccess(actor, perms, "EMPLOYEE"), false, `actor=${actor}`);
  }
});

test("canEditAccess: ADMIN with access.edit override still cannot edit ADMIN (equal rank)", () => {
  const perms = new Set<Permission>(["access.edit"]);
  assert.equal(canEditAccess("ADMIN", perms, "ADMIN"), false);
});

test("canEditAccess: actor without access.edit cannot edit anyone", () => {
  const perms = new Set<Permission>([]);
  assert.equal(canEditAccess("MANAGER", perms, "ADMIN"), false);
});

// ---------- isStaffRole ----------

test("isStaffRole classifies staff roles and rejects junk input", () => {
  assert.equal(isStaffRole("ADMIN"), true);
  assert.equal(isStaffRole("MANAGER"), true);
  assert.equal(isStaffRole("SUPER_ADMIN"), true);
  assert.equal(isStaffRole("EMPLOYEE"), false);
  assert.equal(isStaffRole("BOGUS"), false);
  assert.equal(isStaffRole(undefined), false);
  assert.equal(isStaffRole(null), false);
  assert.equal(isStaffRole(""), false);
  assert.equal(isStaffRole(123 as unknown as string), false);
});

// ---------- STAFF_ROLES / ROLE_LABELS / ROLE_RANK sanity ----------

test("STAFF_ROLES, ROLE_LABELS, ROLE_RANK are as specified", () => {
  assert.deepEqual([...STAFF_ROLES].sort(), ["MANAGER", "ADMIN", "SUPER_ADMIN"].sort());
  assert.deepEqual(ROLE_LABELS, {
    EMPLOYEE: "Employee",
    ADMIN: "Admin",
    MANAGER: "Manager",
    SUPER_ADMIN: "Super Admin",
  });
  assert.deepEqual(ROLE_RANK, { EMPLOYEE: 0, ADMIN: 1, MANAGER: 2, SUPER_ADMIN: 3 });
});

// ---------- hasPermission ----------

test("hasPermission works with Set and array", () => {
  const set = new Set<Permission>(["timesheets.view"]);
  assert.equal(hasPermission(set, "timesheets.view"), true);
  assert.equal(hasPermission(set, "timesheets.edit"), false);
  assert.equal(hasPermission(["timesheets.view"] as const, "timesheets.view"), true);
});
