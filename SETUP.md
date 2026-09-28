# Ptex Timesheet: Local Setup Guide

Get the app running on your machine with one command. The database runs in Docker, so you don't need to install MySQL.

## 1. Install the prerequisites

| Tool | Version | Get it |
|---|---|---|
| **Node.js** | 18.17 or newer (20 LTS recommended) | https://nodejs.org |
| **Docker Desktop** | any recent version | https://www.docker.com/products/docker-desktop/ |
| **Git** | any | https://git-scm.com |

Start **Docker Desktop** and wait until it says it's running before you continue.

## 2. Get the code and install packages

```bash
git clone <repo-url> ptex-timesheet
cd ptex-timesheet
npm install
```

## 3. Start everything

```bash
npm run dev:up
```

That one command does the following, and is safe to run every time you start work:

1. **Creates `.env`** from `.env.example` if you don't have one, with fresh random secrets.
2. **Checks the database** in `DATABASE_URL`. If nothing answers, it starts a MySQL 8 container (`ptex-timesheet-db`) and waits until it's ready.
3. **Applies the database schema** (Prisma migrations).
4. **Loads demo data** (users, masters, activities and tasks), but only when the database is empty. Your data is never overwritten.
5. **Starts the app** at **http://localhost:3000**.

The first run takes a few minutes while Docker downloads MySQL. Later runs start in seconds.

Press **Ctrl+C** to stop the app. The database container keeps running in the background. See [Commands](#commands) to stop it.

## 4. Log in

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@ptexsolutions.com | Admin@123 |
| Manager | admin@ptexsolutions.com | Admin@123 |
| Admin | himanshu@ptexsolutions.com | Manager@123 |
| Employee | tqureshi@ptexsolutions.com | Taha@123 |
| Employee | kv@ptex.com / sk@ptex.com | Taha@123 |

Roles from lowest to highest: **Employee** logs and submits their own timesheets. **Admin** approves timesheets and runs the admin portal. **Manager** can do everything an Admin can, plus the Access Panel and managing Admins. **Super Admin** has full access.

> These are demo passwords. Change them before you put real data in.

## Commands

| Command | What it does |
|---|---|
| `npm run dev:up` | Set up anything missing, then start the app (the everyday command) |
| `npm run dev` | Start the app only (database must already be running) |
| `npm run db:setup` | Everything `dev:up` does, except starting the app |
| `npm run db:up` | Start the database container |
| `npm run db:down` | Stop the database container (data is kept) |
| `npm run db:seed` | Add any missing demo data. Safe to re-run; it never duplicates |
| `npm run db:reset` | ⚠️ **Deletes all data** in the Docker database, then recreates the schema and demo data |
| `npm run db:logs` | Follow the database container's logs |
| `npm run prisma:studio` | Browse and edit the database in your browser |
| `npm test` | Run the unit tests |

## Using a MySQL you already have

If you already run MySQL 8 (XAMPP, MySQL Server, a cloud database), point `.env` at it:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/ptex_db"
```

`npm run dev:up` only starts Docker when nothing answers at that host and port, so with a reachable database it just applies the schema, seeds an empty database and starts the app. Create the empty `ptex_db` database first if your server doesn't allow Prisma to create it.

## Troubleshooting

**"Docker isn't running (or isn't installed)"**
Start Docker Desktop, wait until it's ready, and run `npm run dev:up` again.

**Port 3307 is already in use**
Another program is using the Docker database's port. Pick a free port in `.env`, for example `...@localhost:3308/ptex_db`, and run `npm run dev:up`. The container starts on whatever port your `DATABASE_URL` uses.

**"Migrations failed" / access denied**
The Docker database uses user `root` with password `ptex_root_password`. Check that `DATABASE_URL` in `.env` matches. If you changed it after the first run, either change it back or run `npm run db:reset` (this deletes the Docker database's data).

**The app starts on port 3001, 3002…**
An old dev server is still running. Close the other terminal, or stop the stray `node` processes, then start again. Running two dev servers from the same folder can hang Next.js at "Starting…".

**Windows: `EPERM ... query_engine-windows.dll.node`**
The running dev server has the Prisma engine file locked. Stop the dev server (Ctrl+C), then run the command again.

**Start completely fresh**
```bash
npm run db:reset   # ⚠️ deletes all data in the Docker database
npm run dev:up
```

## What's in the box

- `docker-compose.yml`: the MySQL 8 container (host port 3307, data kept in a Docker volume)
- `scripts/dev-up.mjs`: the setup script behind `dev:up` / `db:setup`
- `prisma/migrations/`: the database schema history
- `prisma/seed.ts`: demo data (safe to re-run)
- `README.md`: features and architecture overview
