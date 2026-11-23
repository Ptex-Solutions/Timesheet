#!/usr/bin/env node
// Runs docker either natively or, on Windows without Docker Desktop, inside
// WSL (`wsl --cd <repo> docker ...`). Used by dev-up.mjs and the db:* npm
// scripts:  node scripts/docker.mjs compose up -d db
//
// Env vars a command needs (e.g. DB_PORT for docker-compose.yml) are passed
// into WSL explicitly, because WSL doesn't inherit the Windows environment.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IS_WIN = process.platform === "win32";
const PASS_ENV = ["DB_PORT"];

function exec(cmd, args, opts) {
  // Windows needs a shell for .cmd shims; join args (all fixed literals or
  // values we built ourselves, never user input).
  return IS_WIN
    ? spawnSync([cmd, ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" "), { shell: true, cwd: ROOT, ...opts })
    : spawnSync(cmd, args, { cwd: ROOT, ...opts });
}

let mode; // "native" | "wsl" | null
// Which docker answers: native first, then WSL on Windows. Cached.
export function dockerMode() {
  if (mode !== undefined) return mode;
  if (exec("docker", ["info"], { encoding: "utf8" }).status === 0) return (mode = "native");
  if (IS_WIN && exec("wsl", ["docker", "info"], { encoding: "utf8" }).status === 0) return (mode = "wsl");
  return (mode = null);
}

// Explains why no docker answered (shown by dev-up when it needs one).
export function dockerProblem() {
  if (!IS_WIN) return "Docker isn't running (or isn't installed).";
  const r = exec("wsl", ["docker", "info"], { encoding: "utf8" });
  const err = `${r.stderr ?? ""}${r.stdout ?? ""}`;
  if (/permission denied/i.test(err)) {
    return (
      "Docker in WSL refused access (permission denied on /var/run/docker.sock).\n" +
      "  Run once inside WSL:  sudo usermod -aG docker $USER\n" +
      "  then from Windows:    wsl --shutdown   (and retry)"
    );
  }
  if (/Cannot connect|Is the docker daemon running/i.test(err)) {
    return "Docker in WSL isn't running. Start it inside WSL:  sudo service docker start";
  }
  return "Docker not found. Install Docker Desktop, or Docker Engine inside WSL.";
}

// Runs `docker <args>` with the detected mode.
export function docker(args, { quiet = false, env = process.env } = {}) {
  const m = dockerMode();
  if (!m) return { ok: false, out: "", err: dockerProblem() };
  const opts = quiet ? { encoding: "utf8", env } : { stdio: "inherit", env };
  const r =
    m === "native"
      ? exec("docker", args, opts)
      : exec(
          "wsl",
          [
            "--cd",
            ROOT,
            "env",
            ...PASS_ENV.filter((k) => env[k] !== undefined).map((k) => `${k}=${env[k]}`),
            "docker",
            ...args,
          ],
          opts
        );
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

// CLI: forward arguments, e.g. `node scripts/docker.mjs logs -f ptex-timesheet-db`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!dockerMode()) {
    console.error(dockerProblem());
    process.exit(1);
  }
  const r = docker(process.argv.slice(2));
  process.exit(r.ok ? 0 : 1);
}
