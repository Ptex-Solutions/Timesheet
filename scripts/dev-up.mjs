#!/usr/bin/env node
// One-command local setup: `npm run dev:up`
//
//   1. Creates .env from .env.example (with fresh random auth secrets) if missing.
//   2. Checks the database in DATABASE_URL. If it isn't reachable and points at
//      this machine, starts the MySQL container from docker-compose.yml and
//      waits until it's healthy.
//   3. Applies Prisma migrations and generates the Prisma client.
//   4. Seeds demo data (users, masters, activities) if the database is empty.
//   5. Starts the Next.js dev server (skip with --no-dev, used by `db:setup`).
//
// Plain Node (no extra dependencies) so it runs the same on Windows/macOS/Linux.

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const CONTAINER = "ptex-timesheet-db";
const START_DEV = !process.argv.includes("--no-dev");

const c = {
  step: (s) => console.log(`\n\x1b[36m▸ ${s}\x1b[0m`),
  ok: (s) => console.log(`  \x1b[32m✔\x1b[0m ${s}`),
  info: (s) => console.log(`  ${s}`),
  warn: (s) => console.log(`  \x1b[33m!\x1b[0m ${s}`),
  fail: (s) => {
    console.error(`\n\x1b[31m✖ ${s}\x1b[0m\n`);
    process.exit(1);
  },
};

// Windows needs a shell to resolve npx/docker (.cmd shims). Node deprecates
// passing an args array together with shell:true, so join into one string
// there — every argument in this script is a fixed literal, never user input.
const IS_WIN = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const r = IS_WIN
    ? spawnSync([cmd, ...args].join(" "), { cwd: ROOT, stdio: "inherit", shell: true, ...opts })
    : spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
  return r.status === 0;
}

function runQuiet(cmd, args) {
  const r = IS_WIN
    ? spawnSync([cmd, ...args].join(" "), { cwd: ROOT, encoding: "utf8", shell: true })
    : spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. .env
// ---------------------------------------------------------------------------
function ensureEnv() {
  c.step("Environment (.env)");
  if (existsSync(ENV_FILE)) {
    c.ok(".env found — using it as is");
  } else {
    if (!existsSync(ENV_EXAMPLE)) c.fail(".env.example is missing — can't create .env");
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    const secret = randomBytes(32).toString("base64url");
    const text = readFileSync(ENV_FILE, "utf8").replace(/replace-with-32-plus-character-random-string-please/g, secret);
    writeFileSync(ENV_FILE, text);
    c.ok("Created .env from .env.example with a fresh random auth secret");
  }
  // Load .env into this process so we can read DATABASE_URL (Prisma and Next
  // read .env themselves too).
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
  if (!process.env.DATABASE_URL) c.fail("DATABASE_URL is not set in .env");
}

// ---------------------------------------------------------------------------
// 2. Database: reuse if reachable, otherwise start the Docker container
// ---------------------------------------------------------------------------
function canConnect(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

async function ensureDatabase() {
  c.step("Database");
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    c.fail(`DATABASE_URL in .env is not a valid URL: ${process.env.DATABASE_URL}`);
  }
  const host = url.hostname;
  const port = Number(url.port || 3306);

  if (await canConnect(host, port)) {
    c.ok(`MySQL reachable at ${host}:${port} — using it`);
    return;
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocal) {
    c.fail(
      `Can't reach the database at ${host}:${port}.\n` +
        "  It isn't on this machine, so it won't be started with Docker. Check DATABASE_URL in .env."
    );
  }

  c.info(`Nothing listening on ${host}:${port} — starting MySQL in Docker…`);
  if (!runQuiet("docker", ["info"]).ok) {
    c.fail(
      "Docker isn't running (or isn't installed).\n" +
        "  • Install/start Docker Desktop: https://www.docker.com/products/docker-desktop/\n" +
        "  • Or point DATABASE_URL in .env at a MySQL 8 server you already have."
    );
  }

  // Publish the container on the same port DATABASE_URL expects.
  if (!run("docker", ["compose", "up", "-d", "db"], { env: { ...process.env, DB_PORT: String(port) } })) {
    c.fail("`docker compose up -d db` failed — see the output above");
  }

  c.info("Waiting for MySQL to become healthy (first start takes ~20–40s)…");
  const deadline = Date.now() + 180_000;
  let status = "";
  while (Date.now() < deadline) {
    status = runQuiet("docker", ["inspect", "-f", "{{.State.Health.Status}}", CONTAINER]).out;
    if (status === "healthy" && (await canConnect(host, port))) break;
    if (status === "unhealthy") c.fail(`Container ${CONTAINER} is unhealthy. Check: docker logs ${CONTAINER}`);
    await sleep(2000);
  }
  if (status !== "healthy") c.fail(`MySQL didn't become ready in time. Check: docker logs ${CONTAINER}`);
  c.ok(`MySQL container ${CONTAINER} is up on ${host}:${port}`);
}

// ---------------------------------------------------------------------------
// 3. Schema
// ---------------------------------------------------------------------------
function migrate() {
  c.step("Schema (Prisma migrations)");
  if (!run("npx", ["prisma", "migrate", "deploy"])) {
    c.fail(
      "Migrations failed. Common causes:\n" +
        "  • Wrong user/password in DATABASE_URL (the Docker DB uses root / ptex_root_password)\n" +
        "  • The database already has tables that weren't created by these migrations"
    );
  }
  c.ok("Database schema is up to date");

  // Windows keeps the Prisma engine locked while a dev server is running; the
  // client is already generated in that case, so only warn.
  const gen = runQuiet("npx", ["prisma", "generate"]);
  if (gen.ok) c.ok("Prisma client generated");
  else if (/EPERM/.test(gen.err + gen.out)) c.warn("Prisma engine file is in use (dev server running?) — kept the existing client");
  else {
    console.error(gen.err || gen.out);
    c.fail("`prisma generate` failed");
  }
}

// ---------------------------------------------------------------------------
// 4. Seed (only an empty database)
// ---------------------------------------------------------------------------
async function seedIfEmpty() {
  c.step("Demo data");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  let users = 0;
  try {
    users = await prisma.user.count();
  } finally {
    await prisma.$disconnect();
  }
  if (users > 0) {
    c.ok(`Database already has ${users} user(s) — skipping seed (run \`npm run db:seed\` to top it up)`);
    return;
  }
  if (!run("npx", ["tsx", "prisma/seed.ts"])) c.fail("Seeding failed — see the output above");
  c.ok("Seeded demo users, masters and activities");
  c.info("Log in with superadmin@ptexsolutions.com / Admin@123 (more accounts in SETUP.md)");
}

// ---------------------------------------------------------------------------
// 5. Dev server
// ---------------------------------------------------------------------------
function startDev() {
  c.step("Starting the dev server (Ctrl+C to stop)");
  const child = IS_WIN
    ? spawn("npx next dev", { cwd: ROOT, stdio: "inherit", shell: true })
    : spawn("npx", ["next", "dev"], { cwd: ROOT, stdio: "inherit" });
  const forward = (sig) => () => child.kill(sig);
  process.on("SIGINT", forward("SIGINT"));
  process.on("SIGTERM", forward("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
}

ensureEnv();
await ensureDatabase();
migrate();
await seedIfEmpty();
if (START_DEV) startDev();
else c.step("Setup complete. Start the app with: npm run dev");
