// Pure activityId formatting — no prisma import, independently testable.
// activityId format: CLIENT.MODULE.TYPE.VERSION.SEQ, e.g. STC.ALL.CR.1.0.4390

export interface BuildActivityIdInput {
  clientCode: string;
  moduleCode: string;
  typeCode: string;
  versionCode: string;
  seq: number;
}

export function buildActivityId({
  clientCode,
  moduleCode,
  typeCode,
  versionCode,
  seq,
}: BuildActivityIdInput): string {
  return [
    clientCode.toUpperCase(),
    moduleCode.toUpperCase(),
    typeCode.toUpperCase(),
    versionCode.toUpperCase(),
    String(seq),
  ].join(".");
}
