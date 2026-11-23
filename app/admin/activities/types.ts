// Shapes the Activities page passes from the server to its client components.

export type MasterBrief = { id: number; code: string; description: string | null };

export type ActivityTask = {
  id: number;
  taskId: string;
  taskName: string;
  poRef: string | null;
  isActive: boolean;
  contractTaskId: number | null;
};

export type ActivityMemberRow = {
  userId: number;
  resourceTypeId: number;
  isActive: boolean;
  user: { name: string; employeeCode: string };
  resourceType: MasterBrief;
};

export type ActivityRow = {
  id: number;
  activityId: string;
  name: string;
  isActive: boolean;
  client: MasterBrief;
  type: MasterBrief;
  product: MasterBrief;
  version: MasterBrief;
  module: MasterBrief;
  cloudOnPrem: MasterBrief | null;
  contract: { id: number; code: string; status: string } | null;
  tasks: ActivityTask[];
  members: ActivityMemberRow[];
};

export async function readJson(r: Response) {
  return r.json().catch(() => ({} as Record<string, any>));
}
