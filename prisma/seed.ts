import { MasterType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createActivity } from "../lib/activity-service";
import { applyActivityScope } from "../lib/activity-scope";
import { saveContract, transitionContract } from "../lib/contract-service";
import { attachLegacyActivity, backfillLegacyActivities } from "../lib/contract-backfill";
import { contractSchema } from "../lib/validations";

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

  const kv = await prisma.user.upsert({
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

  const sk = await prisma.user.upsert({
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

  const superAdmin = await prisma.user.upsert({
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
  type MasterTypeKey = keyof typeof MasterType;
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
    CURRENCY: [
      { code: "GBP", description: "British Pound Sterling" },
      { code: "INR", description: "Indian Rupee" },
      { code: "USD", description: "United States Dollar" },
    ],
    // Commercial billing roles for SOW rates — not the RBAC Role enum.
    RESOURCE_TYPE: [
      { code: "TC", description: "Technical Consultant" },
      { code: "LC", description: "Lead Consultant" },
      { code: "BC", description: "Business Consultant" },
      { code: "SA", description: "Solution Architect" },
    ],
    TASK: [
      { code: "DEV", description: "Development" },
      { code: "TEST", description: "Testing" },
      { code: "DEPLOY", description: "Deployment" },
      { code: "SUP", description: "Support" },
      { code: "DOC", description: "Documentation" },
      { code: "R&D", description: "Feasibility Study and Documentation" },
      { code: "CONFIG", description: "Configure Application" },
      { code: "INTERNAL", description: "Internal" },
      { code: "YOGA", description: "Yoga" },
    ],
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

  // ---- Contracts (SOW) ----
  // Rates, SOW tasks and budgeted hours per role. Created once (matched by
  // code) and activated; totals are derived, never seeded.
  const contractSpecs: {
    code: string;
    description: string;
    client: string;
    currency: string;
    rates: Record<string, string>; // RESOURCE_TYPE code -> rate/hour
    tasks: Record<string, Record<string, string>>; // TASK code -> role -> hours
  }[] = [
    {
      code: "STC/SOW/08OCT2025/01",
      description: "SUMM Cloud: development and feasibility study",
      client: "STC",
      currency: "GBP",
      rates: { TC: "100", LC: "150", SA: "200" },
      tasks: {
        DEV: { TC: "400", LC: "120", SA: "40" },
        "R&D": { TC: "40", SA: "24" },
        TEST: { TC: "80", LC: "16" },
        DEPLOY: { LC: "16", SA: "8" },
      },
    },
    {
      code: "STC/SOW/10FEB2026/04",
      description: "SUMM8 functional support",
      client: "STC",
      currency: "GBP",
      rates: { TC: "80", BC: "95" },
      tasks: { SUP: { TC: "300", BC: "120" }, DOC: { BC: "40" } },
    },
    {
      code: "ESN/SOW/20DEC2023/04",
      description: "Client portal configuration",
      client: "ESN",
      currency: "USD",
      rates: { TC: "120", BC: "140" },
      tasks: { CONFIG: { TC: "200", BC: "60" }, TEST: { TC: "40" } },
    },
    {
      code: "INT/2026/INTERNAL",
      description: "Internal, non-billable time",
      client: "INT",
      currency: "INR",
      rates: { TC: "0" },
      tasks: { INTERNAL: { TC: "0" }, YOGA: { TC: "0" } },
    },
  ];

  const contractIds: Record<string, number> = {};
  for (const c of contractSpecs) {
    const existing = await prisma.contract.findUnique({ where: { code: c.code } });
    if (existing) {
      contractIds[c.code] = existing.id;
      continue;
    }
    const input = contractSchema.parse({
      code: c.code,
      description: c.description,
      clientId: masters.CLIENT[c.client],
      currencyId: masters.CURRENCY[c.currency],
      rates: Object.entries(c.rates).map(([role, rate]) => ({
        resourceTypeId: masters.RESOURCE_TYPE[role],
        ratePerHour: rate,
      })),
      tasks: Object.entries(c.tasks).map(([task, hours]) => ({
        taskMasterId: masters.TASK[task],
        hours: Object.fromEntries(Object.entries(hours).map(([role, h]) => [masters.RESOURCE_TYPE[role], h])),
      })),
    });
    const saved = await saveContract(input, { userId: superAdmin.id });
    await transitionContract(saved.id, "activate");
    contractIds[c.code] = saved.id;
  }

  // ---- Activities (with their SOW tasks and members) ----
  // Created via lib/activity-service.ts's createActivity, which allocates the
  // real global sequence and builds activityId (e.g. STC.ALL.CR.1.0.4390).
  // Only created on the very first run; on an existing database the same
  // specs are used to attach contracts to matching pre-contract Activities.
  const activitySpecs: {
    name: string;
    client: string;
    type: string;
    product: string;
    version: string;
    module: string;
    cloudOnPrem?: string;
    contract: string;
    tasks: string[]; // TASK codes from the contract
    members: [number, string][]; // [userId, RESOURCE_TYPE code]
  }[] = [
    {
      name: "SUMM Cloud Development",
      client: "STC",
      type: "CR",
      product: "SUM",
      version: "1.0",
      module: "ALL",
      cloudOnPrem: "CLOUD",
      contract: "STC/SOW/08OCT2025/01",
      tasks: ["DEV", "R&D"],
      members: [[taha.id, "TC"], [kv.id, "TC"], [sk.id, "LC"]],
    },
    {
      // Same SOW, different Activity: testing and deployment are run separately.
      name: "SUMM Cloud Release",
      client: "STC",
      type: "CR",
      product: "SUM",
      version: "1.0",
      module: "ALL",
      cloudOnPrem: "CLOUD",
      contract: "STC/SOW/08OCT2025/01",
      tasks: ["TEST", "DEPLOY"],
      members: [[taha.id, "TC"], [sk.id, "SA"]],
    },
    {
      name: "SUMM8 Support",
      client: "STC",
      type: "SUP",
      product: "SUM",
      version: "8.0",
      module: "ALL",
      cloudOnPrem: "ON-PREM",
      contract: "STC/SOW/10FEB2026/04",
      tasks: ["SUP", "DOC"],
      members: [[taha.id, "TC"], [kv.id, "BC"]],
    },
    {
      name: "Configure Application",
      client: "ESN",
      type: "ENH",
      product: "PORTAL",
      version: "2.0",
      module: "CORE",
      cloudOnPrem: "CLOUD",
      contract: "ESN/SOW/20DEC2023/04",
      tasks: ["CONFIG", "TEST"],
      members: [[kv.id, "TC"], [sk.id, "BC"]],
    },
    {
      name: "Internal",
      client: "INT",
      type: "BAU",
      product: "COR",
      version: "NA",
      module: "ALL",
      contract: "INT/2026/INTERNAL",
      tasks: ["INTERNAL", "YOGA"],
      members: [[taha.id, "TC"], [kv.id, "TC"], [sk.id, "TC"], [manager.id, "TC"]],
    },
  ];

  const scopeFor = async (a: (typeof activitySpecs)[number]) => {
    const lines = await prisma.contractTask.findMany({
      where: { contractId: contractIds[a.contract] },
      include: { taskMaster: true },
    });
    return {
      contractId: contractIds[a.contract],
      contractTaskIds: lines.filter((l) => a.tasks.includes(l.taskMaster.code)).map((l) => l.id),
      members: a.members.map(([userId, role]) => ({ userId, resourceTypeId: masters.RESOURCE_TYPE[role] })),
    };
  };

  const activityCount = await prisma.activity.count();
  if (activityCount === 0) {
    for (const a of activitySpecs) {
      const scope = await scopeFor(a);
      await prisma.$transaction(
        async (tx) => {
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
          await applyActivityScope(tx, activity.id, scope);
        },
        { timeout: 20_000 }
      );
    }
  } else {
    // Existing database: attach seeded contracts to matching legacy Activities
    // (their old task ids are kept), then give any other legacy Activity its own.
    for (const a of activitySpecs) {
      const legacy = await prisma.activity.findFirst({
        where: { name: a.name, clientId: masters.CLIENT[a.client], contractId: null },
      });
      if (!legacy) continue;
      const scope = await scopeFor(a);
      await prisma.$transaction(
        (tx) =>
          attachLegacyActivity(tx, legacy.id, scope.contractId, {
            members: scope.members,
            defaultRoleId: scope.members[0].resourceTypeId,
            alsoLineCodes: a.tasks,
          }),
        { timeout: 20_000 }
      );
      console.log(`  Attached ${legacy.activityId} to ${a.contract}`);
    }
    await backfillLegacyActivities({ userId: superAdmin.id, log: console.log });
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
