import { MasterType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createActivity } from "../lib/activity-service";

const prisma = new PrismaClient();

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);

async function main() {
  console.log("Seeding Ptex database...");

  // ---- Users ----
  const managerPwd = await bcrypt.hash("Manager@123", ROUNDS);
  const employeePwd = await bcrypt.hash("Taha@123", ROUNDS);
  const adminPwd = await bcrypt.hash("Admin@123", ROUNDS);

  const manager = await prisma.user.upsert({
    where: { email: "himanshu@ptexsolutions.com" },
    update: {},
    create: {
      name: "Operations Manager",
      email: "himanshu@ptexsolutions.com",
      password: managerPwd,
      // Admin = day-to-day approver (below Manager).
      role: Role.ADMIN,
      employeeCode: "MGR",
    },
  });

  const taha = await prisma.user.upsert({
    where: { email: "tqureshi@ptexsolutions.com" },
    update: {},
    create: {
      name: "Taha Qureshi",
      email: "tqureshi@ptexsolutions.com",
      password: employeePwd,
      role: Role.EMPLOYEE,
      employeeCode: "TQ",
    },
  });

  await prisma.user.upsert({
    where: { email: "kv@ptex.com" },
    update: {},
    create: {
      name: "Karunakar Verma",
      email: "kv@ptex.com",
      password: employeePwd,
      role: Role.EMPLOYEE,
      employeeCode: "KV",
    },
  });

  await prisma.user.upsert({
    where: { email: "sk@ptex.com" },
    update: {},
    create: {
      name: "Shriyansh Kumar",
      email: "sk@ptex.com",
      password: employeePwd,
      role: Role.EMPLOYEE,
      employeeCode: "SK",
    },
  });

  await prisma.user.upsert({
    where: { email: "superadmin@ptexsolutions.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@ptexsolutions.com",
      password: adminPwd,
      role: Role.SUPER_ADMIN,
      employeeCode: "SA",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@ptexsolutions.com" },
    update: {},
    create: {
      name: "Administrator",
      email: "admin@ptexsolutions.com",
      password: adminPwd,
      // Manager sits above Admin (Access Panel, manages Admins).
      role: Role.MANAGER,
      employeeCode: "ADM",
    },
  });

  // ---- Masters ----
  type MasterTypeKey = "TYPE" | "CLIENT" | "PRODUCT" | "VERSION" | "MODULE" | "CLOUD_ON_PREM";
  const masterSpecs: Record<MasterTypeKey, { code: string; description?: string }[]> = {
    TYPE: [
      { code: "CR", description: "Change Request" },
      { code: "BAU", description: "Business as Usual" },
      { code: "ENH", description: "Enhancement" },
      { code: "SUP", description: "Support" },
    ],
    CLIENT: [
      { code: "STC", description: "STC Group" },
      { code: "INT", description: "Internal" },
      { code: "ESN", description: "Essilor Networks" },
      { code: "FRL", description: "Future Retail Ltd" },
      { code: "LTP", description: "LTP Holdings" },
      { code: "FKG", description: "FKG Industries" },
      { code: "VSI", description: "VSI Solutions" },
      { code: "ADI", description: "ADI Systems" },
      { code: "IDLE", description: "Idle / Unbilled" },
    ],
    PRODUCT: [
      { code: "SUM", description: "Summit" },
      { code: "COR", description: "Core Platform" },
      { code: "PORTAL", description: "Client Portal" },
    ],
    VERSION: [{ code: "1.0" }, { code: "2.0" }, { code: "8.0" }, { code: "NA" }],
    MODULE: [
      { code: "ALL", description: "All Modules" },
      { code: "CORE", description: "Core" },
      { code: "RPT", description: "Reporting" },
    ],
    CLOUD_ON_PREM: [{ code: "CLOUD" }, { code: "ON-PREM" }],
  };

  // masters[type][code] -> Master.id
  const masters = {} as Record<MasterTypeKey, Record<string, number>>;
  for (const type of Object.keys(masterSpecs) as MasterTypeKey[]) {
    masters[type] = {};
    for (const m of masterSpecs[type]) {
      const row = await prisma.master.upsert({
        where: { type_code: { type: MasterType[type], code: m.code } },
        update: {},
        create: { type: MasterType[type], code: m.code, description: m.description ?? null },
      });
      masters[type][m.code] = row.id;
    }
  }

  // ---- Activity sequence (singleton; never reset if it already exists) ----
  await prisma.activitySequence.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, current: 4389 },
  });

  // ---- Activities + Tasks ----
  // Created via lib/activity-service.ts's createActivity, which allocates the
  // real global sequence and builds activityId (e.g. STC.ALL.CR.1.0.4390).
  // Only seeded on the very first run (idempotent re-run just skips this
  // block — seq allocation is one-shot and can't be "found or created" the
  // way upserts elsewhere in this file can).
  const activitySpecs: {
    name: string;
    client: string;
    type: string;
    product: string;
    version: string;
    module: string;
    cloudOnPrem?: string;
    tasks: { taskId: string; taskName: string; poRef: string | null }[];
  }[] = [
    {
      name: "SUMM Cloud Development",
      client: "STC",
      type: "CR",
      product: "SUM",
      version: "1.0",
      module: "ALL",
      cloudOnPrem: "CLOUD",
      tasks: [
        { taskId: "DEV", taskName: "SUMM Cloud - Development", poRef: "STC/SOW/08OCT2025/01" },
        { taskId: "R&D", taskName: "SUMM Cloud - Feasibility Study and Documentation", poRef: null },
      ],
    },
    {
      name: "SUMM8 Support",
      client: "STC",
      type: "SUP",
      product: "SUM",
      version: "8.0",
      module: "ALL",
      cloudOnPrem: "ON-PREM",
      tasks: [
        { taskId: "SUP", taskName: "SUMM8-Support-Functional-Internal", poRef: "STC/SOW/10FEB2026/04" },
      ],
    },
    {
      name: "Configure Application",
      client: "ESN",
      type: "ENH",
      product: "PORTAL",
      version: "2.0",
      module: "CORE",
      cloudOnPrem: "CLOUD",
      tasks: [{ taskId: "SOW", taskName: "Configure Application", poRef: "ESN/SOW/20DEC2023/04" }],
    },
    {
      name: "Internal",
      client: "INT",
      type: "BAU",
      product: "COR",
      version: "NA",
      module: "ALL",
      tasks: [
        { taskId: "Internal", taskName: "Internal", poRef: null },
        { taskId: "Yoga", taskName: "Yoga", poRef: null },
      ],
    },
  ];

  const activityCount = await prisma.activity.count();
  if (activityCount === 0) {
    for (const a of activitySpecs) {
      await prisma.$transaction(async (tx) => {
        const activity = await createActivity(
          {
            name: a.name,
            clientId: masters.CLIENT[a.client],
            typeId: masters.TYPE[a.type],
            productId: masters.PRODUCT[a.product],
            versionId: masters.VERSION[a.version],
            moduleId: masters.MODULE[a.module],
            cloudOnPremId: a.cloudOnPrem ? masters.CLOUD_ON_PREM[a.cloudOnPrem] : null,
          },
          tx
        );
        await tx.task.createMany({
          data: a.tasks.map((t) => ({
            taskId: t.taskId,
            taskName: t.taskName,
            poRef: t.poRef,
            activityId: activity.id,
          })),
        });
      });
    }
  } else {
    console.log(`  Skipping activity seed (already ${activityCount} activities present).`);
  }

  console.log("Seed complete:");
  console.log("  Super Admin: superadmin@ptexsolutions.com / Admin@123");
  console.log("  Manager:     admin@ptexsolutions.com      / Admin@123");
  console.log(`  Admin:       himanshu@ptexsolutions.com   / Manager@123 (id ${manager.id})`);
  console.log(`  Employee:    tqureshi@ptexsolutions.com   / Taha@123    (id ${taha.id})`);
  console.log("  Employees:   kv@ptex.com, sk@ptex.com     / Taha@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
