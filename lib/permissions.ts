// Pure permission logic. No prisma/next/node-only imports — this module is
// consumed by API routes, server components, edge middleware, and client
// components alike.

// Rank order (lowest first): Admin is the day-to-day approver, Manager sits
// above it (Access Panel, manages Admins), Super Admin above everyone.
export const ROLES = ["EMPLOYEE", "ADMIN", "MANAGER", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  EMPLOYEE: 0,
  ADMIN: 1,
  MANAGER: 2,
  SUPER_ADMIN: 3,
};

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: "Employee",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SUPER_ADMIN: "Super Admin",
};

export const STAFF_ROLES = ["ADMIN", "MANAGER", "SUPER_ADMIN"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string | undefined | null): role is StaffRole {
  return typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);
}

// ---------------------------------------------------------------------------
// Permission catalogue
// ---------------------------------------------------------------------------

export const ACTION_LABELS = {
  view: "View",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  reopen: "Re-open",
  finalize: "Finalize",
} as const;

export type Action = keyof typeof ACTION_LABELS;

export const BASE_ACTIONS: readonly Action[] = ["view", "edit", "delete"];

export const MODULES = [
  {
    key: "timesheets",
    label: "Timesheets",
    actions: ["view", "edit", "delete", "approve", "reopen"],
  },
  {
    key: "mis",
    label: "MIS Reports",
    actions: ["view", "edit", "delete", "finalize"],
  },
  {
    key: "clients",
    label: "Masters & Activities",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "sandbox",
    label: "Sandbox MIS",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "employees",
    label: "Employees",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "access",
    label: "Access Panel",
    actions: ["view", "edit"],
  },
] as const satisfies readonly { key: string; label: string; actions: readonly Action[] }[];

export type ModuleKey = (typeof MODULES)[number]["key"];

// Mapped type distributes over the MODULES union, so each module's key is
// paired only with its own actions (not the cross product of every module's
// key with every other module's actions).
type ModulePermissionMap = {
  [M in (typeof MODULES)[number] as M["key"]]: `${M["key"]}.${M["actions"][number]}`;
};

export type Permission = ModulePermissionMap[ModuleKey];

export const ALL_PERMISSIONS: Permission[] = MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a}` as Permission)
);

const ALL_PERMISSIONS_SET: Set<string> = new Set(ALL_PERMISSIONS);

export function isPermission(s: string): s is Permission {
  return ALL_PERMISSIONS_SET.has(s);
}

// ---------------------------------------------------------------------------
// Role defaults & overrides
// ---------------------------------------------------------------------------

export type PermissionOverride = {
  module: string;
  action: string;
  granted: boolean;
};

export function roleDefaults(role: Role): Set<Permission> {
  switch (role) {
    case "EMPLOYEE":
      return new Set();
    case "ADMIN":
      return new Set(ALL_PERMISSIONS.filter((p) => !p.startsWith("access.")));
    case "MANAGER":
    case "SUPER_ADMIN":
      return new Set(ALL_PERMISSIONS);
  }
}

export function resolvePermissions(
  role: Role,
  overrides: PermissionOverride[]
): Set<Permission> {
  const perms = roleDefaults(role);

  // SUPER_ADMIN and EMPLOYEE ignore overrides entirely.
  if (role === "SUPER_ADMIN" || role === "EMPLOYEE") {
    return perms;
  }

  for (const override of overrides) {
    const key = `${override.module}.${override.action}`;
    if (!isPermission(key)) continue;
    if (override.granted) {
      perms.add(key);
    } else {
      perms.delete(key);
    }
  }

  return perms;
}

export function diffOverrides(role: Role, desired: Iterable<Permission>): PermissionOverride[] {
  const defaults = roleDefaults(role);
  const desiredSet = new Set(desired);

  const revokes: PermissionOverride[] = [];
  const grants: PermissionOverride[] = [];

  for (const p of ALL_PERMISSIONS) {
    const inDefaults = defaults.has(p);
    const inDesired = desiredSet.has(p);
    if (inDefaults && !inDesired) {
      const [module, action] = p.split(".");
      revokes.push({ module, action, granted: false });
    } else if (!inDefaults && inDesired) {
      const [module, action] = p.split(".");
      grants.push({ module, action, granted: true });
    }
  }

  return [...revokes, ...grants];
}

// ---------------------------------------------------------------------------
// Role / access management checks
// ---------------------------------------------------------------------------

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "SUPER_ADMIN") return true;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

export function canEditAccess(
  actorRole: Role,
  actorPerms: Set<Permission>,
  targetRole: Role
): boolean {
  if (!actorPerms.has("access.edit")) return false;
  if (targetRole !== "MANAGER" && targetRole !== "ADMIN") return false;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

export function hasPermission(
  perms: Set<Permission> | readonly string[],
  p: Permission
): boolean {
  if (perms instanceof Set) return perms.has(p);
  return perms.includes(p);
}
