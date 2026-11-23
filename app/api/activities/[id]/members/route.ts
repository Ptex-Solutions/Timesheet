import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit, badRequest, parseId, readJsonBody, requirePermission } from "@/lib/api-utils";
import { activityMemberSchema } from "@/lib/validations";

// Quick member edits for one Activity (Activities accordion, Members tab).
//   POST   { userId, resourceTypeId }            add an active member
//   PUT    { userId, resourceTypeId?, isActive? } change role / active flag
//   DELETE ?userId=                               remove the member
// Billing roles must be priced on the Activity's contract. Removing or
// deactivating a member never touches their existing timesheets (each entry
// keeps its own resourceTypeId snapshot).

type Ctx = { params: { id: string } };

async function loadActivity(idParam: string) {
  const id = parseId(idParam);
  if (!id) return badRequest("Invalid activity id");
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { contract: { include: { rates: { select: { resourceTypeId: true } } } } },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!activity.contract) return badRequest("Attach a Contract to this Activity before adding members");
  return activity;
}

function roleAllowed(activity: Exclude<Awaited<ReturnType<typeof loadActivity>>, NextResponse>, roleId: number) {
  return activity.contract!.rates.some((r) => r.resourceTypeId === roleId);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requirePermission("activities.edit");
  if (access instanceof NextResponse) return access;
  const activity = await loadActivity(params.id);
  if (activity instanceof NextResponse) return activity;
  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = activityMemberSchema.safeParse(json.body);
  if (!parsed.success || !parsed.data.resourceTypeId) return badRequest("Pick a person and a role");
  const { userId, resourceTypeId } = parsed.data;

  if (!roleAllowed(activity, resourceTypeId)) {
    return badRequest(`Role must be one of the roles priced on contract ${activity.contract!.code}`);
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return badRequest("Unknown or inactive user");
  const exists = await prisma.activityMember.findUnique({
    where: { activityId_userId: { activityId: activity.id, userId } },
  });
  if (exists) return NextResponse.json({ error: `${user.name} is already a member` }, { status: 409 });

  const data = await prisma.activityMember.create({ data: { activityId: activity.id, userId, resourceTypeId } });
  await audit({
    userId: access.user.id,
    action: "member.add",
    entity: "Activity",
    entityId: activity.id,
    meta: { memberId: userId, resourceTypeId },
  });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const access = await requirePermission("activities.edit");
  if (access instanceof NextResponse) return access;
  const activity = await loadActivity(params.id);
  if (activity instanceof NextResponse) return activity;
  const json = await readJsonBody(req);
  if (json instanceof NextResponse) return json;
  const parsed = activityMemberSchema.safeParse(json.body);
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
  const { userId, resourceTypeId, isActive } = parsed.data;

  if (resourceTypeId !== undefined && !roleAllowed(activity, resourceTypeId)) {
    return badRequest(`Role must be one of the roles priced on contract ${activity.contract!.code}`);
  }
  const key = { activityId_userId: { activityId: activity.id, userId } };
  if (!(await prisma.activityMember.findUnique({ where: key }))) {
    return NextResponse.json({ error: "Not a member" }, { status: 404 });
  }
  const data = await prisma.activityMember.update({
    where: key,
    data: {
      ...(resourceTypeId !== undefined ? { resourceTypeId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  await audit({
    userId: access.user.id,
    action: "member.update",
    entity: "Activity",
    entityId: activity.id,
    meta: { memberId: userId, resourceTypeId, isActive },
  });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const access = await requirePermission("activities.edit");
  if (access instanceof NextResponse) return access;
  const activity = await loadActivity(params.id);
  if (activity instanceof NextResponse) return activity;
  const userId = parseId(req.nextUrl.searchParams.get("userId"));
  if (!userId) return badRequest("Missing or invalid userId");
  const deleted = await prisma.activityMember.deleteMany({ where: { activityId: activity.id, userId } });
  if (deleted.count === 0) return NextResponse.json({ error: "Not a member" }, { status: 404 });
  await audit({
    userId: access.user.id,
    action: "member.remove",
    entity: "Activity",
    entityId: activity.id,
    meta: { memberId: userId },
  });
  return NextResponse.json({ ok: true });
}
