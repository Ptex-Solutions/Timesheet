export const ROLES = ["EMPLOYEE", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];
