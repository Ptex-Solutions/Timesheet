// Master categories and their UI labels. Pure (no prisma import) so client
// components can use it; the string values mirror the Prisma `MasterType` enum.

export const MASTER_TYPE_OPTIONS = [
  { value: "TYPE", label: "Type" },
  { value: "CLIENT", label: "Client" },
  { value: "PRODUCT", label: "Product" },
  { value: "VERSION", label: "Version" },
  { value: "MODULE", label: "Module" },
  { value: "CLOUD_ON_PREM", label: "Cloud / On Prem" },
  { value: "CURRENCY", label: "Currency" },
  { value: "RESOURCE_TYPE", label: "Resource Type" },
  { value: "TASK", label: "Tasks" },
] as const;

export type MasterTypeValue = (typeof MASTER_TYPE_OPTIONS)[number]["value"];

export const MASTER_TYPE_LABEL = Object.fromEntries(
  MASTER_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<MasterTypeValue, string>;

// The categories an Activity is built from (its FK columns). Contract-only
// categories (CURRENCY, RESOURCE_TYPE, TASK) are deliberately excluded.
export const ACTIVITY_MASTER_TYPES = [
  "CLIENT",
  "TYPE",
  "PRODUCT",
  "VERSION",
  "MODULE",
  "CLOUD_ON_PREM",
] as const satisfies readonly MasterTypeValue[];

export type ActivityMasterType = (typeof ACTIVITY_MASTER_TYPES)[number];
