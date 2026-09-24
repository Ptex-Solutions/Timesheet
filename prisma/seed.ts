import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

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
      role: Role.MANAGER,
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
      role: Role.ADMIN,
      employeeCode: "ADM",
    },
  });

  // ---- Clients ----
  const clientSpecs = [
    { code: "STC", name: "STC Group" },
    { code: "INT", name: "Internal" },
    { code: "ESN", name: "Essilor Networks" },
    { code: "FRL", name: "Future Retail Ltd" },
    { code: "LTP", name: "LTP Holdings" },
    { code: "FKG", name: "FKG Industries" },
    { code: "VSI", name: "VSI Solutions" },
    { code: "ADI", name: "ADI Systems" },
    { code: "IDLE", name: "Idle / Unbilled" },
  ];

  const clients: Record<string, number> = {};
  for (const c of clientSpecs) {
    const row = await prisma.client.upsert({
      where: { clientCode: c.code },
      update: { clientName: c.name },
      create: { clientCode: c.code, clientName: c.name },
    });
    clients[c.code] = row.id;
  }

  // ---- Projects ----
  const projectSpecs = [
    {
      activityId: "STC.ALL.LNG.2.0.4375",
      description: "Timeline-Support-Technical",
      client: "STC",
    },
    {
      activityId: "STC.ALL.LNG.8.0.4377",
      description: "SUMM Cloud / SUMM8",
      client: "STC",
    },
    {
      activityId: "INT.ALL.BCH.NA.101",
      description: "Internal",
      client: "INT",
    },
    {
      activityId: "ESN.ALL.IMP.CLD.4322",
      description: "Configure Application",
      client: "ESN",
    },
  ];

  const projects: Record<string, number> = {};
  for (const p of projectSpecs) {
    const row = await prisma.project.upsert({
      where: { activityId: p.activityId },
      update: { description: p.description },
      create: {
        activityId: p.activityId,
        description: p.description,
        clientId: clients[p.client],
      },
    });
    projects[p.activityId] = row.id;
  }

  // ---- Tasks ----
  const taskSpecs = [
    {
      taskId: "SUP",
      taskName: "Timeline-Support-Technical-Bug and Maintenance",
      poRef: "STC/SOW/08OCT2025/01",
      activityId: "STC.ALL.LNG.2.0.4375",
    },
    {
      taskId: "R&D",
      taskName: "SUMM Cloud - Feasibility Study and Documentation",
      poRef: null,
      activityId: "STC.ALL.LNG.8.0.4377",
    },
    {
      taskId: "MTG",
      taskName: "SUMM8-Support-Functional-Internal",
      poRef: "STC/SOW/10FEB2026/04",
      activityId: "STC.ALL.LNG.8.0.4377",
    },
    {
      taskId: "SOW",
      taskName: "Configure Application",
      poRef: "ESN/SOW/20DEC2023/04",
      activityId: "ESN.ALL.IMP.CLD.4322",
    },
    {
      taskId: "Internal",
      taskName: "Internal",
      poRef: null,
      activityId: "INT.ALL.BCH.NA.101",
    },
    {
      taskId: "Yoga",
      taskName: "Yoga",
      poRef: null,
      activityId: "INT.ALL.BCH.NA.101",
    },
  ];

  for (const t of taskSpecs) {
    const projectId = projects[t.activityId];
    const existing = await prisma.task.findFirst({
      where: { taskId: t.taskId, projectId },
    });
    if (!existing) {
      await prisma.task.create({
        data: {
          taskId: t.taskId,
          taskName: t.taskName,
          poRef: t.poRef ?? undefined,
          projectId,
        },
      });
    } else {
      await prisma.task.update({
        where: { id: existing.id },
        data: {
          taskName: t.taskName,
          poRef: t.poRef ?? undefined,
        },
      });
    }
  }

  console.log("Seed complete:");
  console.log(`  Manager: himanshu@ptexsolutions.com / Himanshu@123 (id ${manager.id})`);
  console.log(`  Employee: tqureshi@ptexsolutions.com / Taha@123 (id ${taha.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
