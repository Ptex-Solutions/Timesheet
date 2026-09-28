# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Ptex Timesheet & MIS dashboard: Next.js 14 App Router + TypeScript + Prisma (MySQL) + NextAuth v5 (JWT credentials). Two portals: `/employee/*` (EMPLOYEE) and `/admin/*` (all *staff*: ADMIN, MANAGER, SUPER_ADMIN), with per-module permissions inside the admin portal. Old `/manager/*` URLs redirect to `/admin/*` (`next.config.mjs`).

## Commands

```bash
npm run dev:up           # one-command setup (scripts/dev-up.mjs, guide in SETUP.md): .env, Docker MySQL if DATABASE_URL unreachable, migrate deploy, seed-if-empty, next dev
npm run db:setup         # same without starting next dev; also db:up / db:down / db:seed / db:reset (⚠️ wipes the Docker volume)
npm run dev              # dev server on http://localhost:3000
npm run build            # prisma generate + next build
npm run start            # run production build (or `node server.js`, custom HTTP server on :3000, dev:false)
npm run lint             # next lint
npm run prisma:push      # sync schema to DB without migration files (what README setup uses)
npm run prisma:migrate   # create + apply migration (prisma/migrations/)
npm run prisma:seed      # tsx prisma/seed.ts — masters/activities/tasks + demo users
npm run prisma:studio
npm test                 # node:test via tsx — lib/permissions, lib/activity-code, lib/entry-date tests
npx tsc --noEmit         # typecheck (no separate script)
```

Tests use the built-in `node:test` runner (no Jest); coverage is the pure permission logic plus activity-code generation (`lib/activity-code.ts`). No ESLint config is committed. Setup: copy `.env.example` → `.env` (`DATABASE_URL`, `NEXTAUTH_SECRET`/`AUTH_SECRET`, `AUTH_TRUST_HOST`, `BCRYPT_ROUNDS`). Demo logins are listed in README.md.

## Architecture

### Roles & permissions (RBAC)

- **Roles** (rank order): `EMPLOYEE < ADMIN < MANAGER < SUPER_ADMIN` — **Admin** is the day-to-day approver, **Manager** sits above it (Access Panel, manages Admins). ADMIN/MANAGER/SUPER_ADMIN are **staff** (`STAFF_ROLES`, `isStaffRole`) and share the `/admin/*` portal. (Code identifiers such as `ManagerShell`, `app/admin/*/manager.tsx` and the `managerNote` column predate this naming and were left as is.)
- **Permission catalogue**: `lib/permissions.ts` — pure and edge-safe (no prisma/next imports; used by middleware, routes, server and client components). `MODULES` lists each module's actions (`view`/`edit`/`delete` plus specials `timesheets.approve`, `timesheets.reopen`, `mis.finalize`); `Permission` is the `"module.action"` union.
- **Effective permissions** = `roleDefaults(role)` + per-user overrides in `UserPermission { userId, module, action, granted }` (`resolvePermissions`). ADMIN defaults = everything except `access.*`; MANAGER/SUPER_ADMIN = everything. SUPER_ADMIN and EMPLOYEE ignore overrides. `diffOverrides(role, desired)` computes the minimal override rows for a desired set. Changing a user's role (`PUT /api/users`) deletes their overrides in the same transaction.
- **Resolved from the DB on every request**, never from the JWT (the JWT only carries `role` for middleware), so Access Panel changes apply immediately:
  1. **`middleware.ts`** gates coarsely by role: staff-only paths (`/admin`, `/api/sandbox`, `/api/mis`, `/api/users`, `/api/tasks`, `/api/access`). Update both that list and `matcher` when adding a protected route. `/api/masters` and `/api/activities` are intentionally not staff-only — employees need them to populate the Client → Activity → Task cascade on the timesheet form; each handler filters to `isActive: true` rows unless the caller has `masters.view` / `activities.view` respectively, or explicitly requests active-only via the `?active=1` query param (used by the employee timesheet form so a staff member with those view permissions doesn't see inactive rows while filling out their own timesheet).
  2. **Route handlers** call `requirePermission("module.action")` from `lib/api-utils.ts`, which returns `{ user, perms }` or a `NextResponse` — `const a = await requirePermission(...); if (a instanceof NextResponse) return a;`. `getCurrentAccess`/`requirePermission` re-read the user from the DB and reject deactivated users. `requireUser()` is JWT-only (returns the session user without a DB check) and is used only for dropdown-data GETs.
  3. **Pages/layouts** call `getCurrentAccess()` (`lib/authz.ts`) and `redirect("/admin/dashboard")` when the page's `*.view` permission is missing. `app/admin/layout.tsx` passes `perms` to `components/shared/manager-shell.tsx`, whose `ITEMS` list gates each nav link on a permission; pages pass booleans like `canEdit` down to client components to hide actions.
- **Role vs permission changes**: permission (override) changes take effect on the next request. A **role** change only reaches `middleware.ts` after the user re-logs in, because the JWT carries `role` (route handlers and pages already use the DB role).
- **Role management**: `canManageRole` (actor must outrank target; SUPER_ADMIN manages all). The **last active Super Admin** can't be demoted/deactivated — enforced atomically in `app/api/users/route.ts` (`FOR UPDATE` + recount inside a transaction).
- **Access Panel** (`/admin/access`, `app/api/access/*`, loader `lib/access-data.ts`): per-user permission matrix for ADMIN/MANAGER targets. Editing requires `access.edit` and `canEditAccess` (actor outranks target; SUPER_ADMIN/EMPLOYEE not editable). **No escalation**: an actor can't grant (or reset into) a permission they don't hold. Any non-view action requires that module's `view` (400 otherwise). Saves replace the user's override rows in one transaction and audit `permissions.update` / `permissions.reset`.

Session shape (`id: number`, `role`, `employeeCode`) is declared via module augmentation in `lib/auth.ts`; `lib/auth-handlers.ts` re-exports `handlers` for `app/api/auth/[...nextauth]`.

**Employee data scoping is enforced server-side**: when the caller lacks `timesheets.view` (i.e. employees, or staff with it revoked), handlers force `where.userId = user.id` and ignore any `userId` query param (see `app/api/timesheets/route.ts`). Preserve this in any new timesheet query.

### Data flow patterns

- **Reads**: most `page.tsx` files are async Server Components querying `prisma` directly (no API hop).
- **Writes**: client components (`*.tsx` siblings like `manager.tsx`, `form.tsx`, `editor.tsx`, `actions.tsx`, `approval-panel.tsx`) `fetch` the REST routes under `app/api/*`, toast via `sonner`, then `router.refresh()`. No server actions in use.
- **Every mutation** calls `audit({ userId, action, entity, entityId, meta })` → `AuditLog` table. `audit` swallows its own errors.
- Input validation: Zod schemas in `lib/validations.ts`, `safeParse` in handlers, 400 with `parsed.error.flatten()` on failure.

### Timesheet domain model

Hierarchy: `Master` → `Activity` → `Task`. Timesheet (and SandboxEntry) rows point at `clientId` (a `Master`), `activityId` (an `Activity`), and `taskId` (a `Task`).

- **`Master`** (`prisma/schema.prisma`): generic `{ type, code, description? }` rows, one table for six categories via the `MasterType` enum — `TYPE`, `CLIENT`, `PRODUCT`, `VERSION`, `MODULE`, `CLOUD_ON_PREM`. `Client` is *just another Master row* (`type = CLIENT`); there is no separate `Client` model. Unique on `(type, code)`. CRUD at `/admin/masters` (`app/admin/masters/panel.tsx`, `app/api/masters/route.ts`) — pick a master type from a dropdown, then CRUD the CODE/Description table below it. Deleting a referenced Master soft-deletes (`isActive: false`) instead of failing; never hard-deleted while referenced.
- **`Activity`** (renamed from the old `Project`): built by picking Client + Type + Product + Version + Module (+ optional Cloud/On Prem) from the Masters above, plus a free-text `name`. Its `activityId` is auto-generated, not user-entered, as `CLIENT.MODULE.TYPE.VERSION.SEQ` (e.g. `STC.ALL.CR.1.0.4390`) via `createActivity` in `lib/activity-service.ts`:
  - `buildActivityId` (`lib/activity-code.ts`) is the pure, prisma-free formatter — independently unit-tested.
  - `allocateNextSeq` allocates the next number from the single-row `ActivitySequence` table using `SELECT ... FOR UPDATE` + `UPDATE` inside a transaction (same locking pattern as the last-Super-Admin guard in `app/api/users/route.ts`), so concurrent creations can't collide. The sequence is **global** across all clients/types and starts at **4390**.
  - The five id-forming fields (client, type, product, version, module) are **immutable after creation** — historical timesheets depend on the code staying stable. Only `name`, `cloudOnPrem`, and `isActive` can be edited afterward (`PUT /api/activities` rejects changes to the others).
  - Admin screen: `/admin/activities` (`app/admin/activities/manager.tsx`, `app/api/activities/route.ts`) — list/create/edit/deactivate Activities, with a nested Task CRUD per Activity (`app/api/tasks/route.ts`).
- **`Task`** is unchanged in shape (`taskId`, `taskName`, `poRef`), just re-parented under `Activity` instead of `Project` (`activityId` FK).
- Permissions: `/admin/masters` + `/api/masters` mutations use the **`masters.*`** module; `/admin/activities`, `/api/activities` and `/api/tasks` mutations use **`activities.*`** (two separate Access Panel rows; migration `20260928160000_split_masters_activities_permissions` copied old combined `clients.*` overrides to both).
- **Employee timesheet entry** is inline on "All My Timesheets" (`app/employee/timesheet/timesheet-table.tsx`): "Add row" / per-row "Clone" insert editable draft rows, and the pencil edits DRAFT/REJECTED rows in place (PUT); new rows default to the latest logged date, or the next day once it has 8h (`lib/entry-date.ts`, unit-tested) (one `GET /api/activities?active=1` feeds the whole cascade), saved via `POST /api/timesheets` one at a time or with "Save all" (sequential, so the 24h/day cap can't race). `/employee/timesheet/new` just redirects to `?add=1`. The single-entry form (`components/employee/timesheet-form.tsx`) is still used by the draft edit page. Cascading selects **Client → Activity → Task** (`/api/masters?type=CLIENT` → `/api/activities?clientId=` → the chosen activity's `tasks`). `Type` is no longer a manual dropdown — it's read from the selected Activity's Type master (`activity.type.code`) and shown read-only. Date, Hours, Description stay manual; Week No./Week Label/Day/Minutes are auto-derived client-side for display and re-derived server-side on save.
- **`lib/timesheet-refs.ts`'s `resolveTimesheetRefs(activityId, taskId, allowInactive?)`** is the shared server-side validator used by both the timesheets API and the sandbox API — **security-relevant**: it re-fetches the Activity and Task from the DB, checks `task.activityId === activity.id` (rejects a stale form or a crafted request pairing a task with an unrelated activity), rejects inactive activities/tasks unless `allowInactive` explicitly permits keeping the entry's existing id on an edit, and derives `clientId` and `type` server-side from the Activity rather than trusting client-submitted values. Never trust a client-submitted `clientId`/`type` on a timesheet or sandbox write — always go through this helper.
- **Week is Saturday–Friday**, not ISO Mon–Sun. `lib/utils.ts`: `weekLabelForDate` (e.g. `"06/09 - 12/09"`), `weekdayKey`, `dayCount`. `weekNo` however comes from `isoYearWeek` (ISO week number). Server derives `weekNo`, `weekLabel`, `minutes`, and the per-day columns (`sat`..`fri` — only the entry's own day is non-zero) on create/update; clients don't send them.
- Per-user per-day total hours capped at 24 (checked in POST handler).
- Status flow: `DRAFT → SUBMITTED → APPROVED | REJECTED`. Employees can edit/delete/submit only their own DRAFTs (and fix/resubmit their REJECTED ones); **nobody else ever edits or deletes a timesheet record** — the `timesheets` module has only `view`/`approve`/`reopen` (Access Panel shows Edit/Delete as N/A). Staff with `timesheets.approve` approve/reject with `rejectionNote` (a decision can't carry field edits). **Re-open** (`timesheets.reopen`) moves `APPROVED → DRAFT` (clears `approvedAt`/`submittedAt`/`rejectionNote`) and can't be combined with field edits in the same request.

### Sandbox & MIS

- **Sandbox** (`SandboxEntry`) is a staff-only scratch copy of timesheets grouped by string `sandboxLabel` (no separate sandbox table). Creating one clones real timesheets in a date range (`originalId` links back). Edits set `isAdded` / `isModified` / `isDeleted` (soft delete) flags; real `Timesheet` rows are never touched. Employees must never see sandbox data.
- **MIS engine** (`lib/mis-engine.ts`): `generateMIS({ source: "timesheets" | "sandbox", ... })` produces `MISData` (flat `rows` + `byEmployee`/`byClient`/`byType`/`byWeek`/`byEmployeePerWeek` aggregates). Timesheet source only includes `SUBMITTED` + `APPROVED`; sandbox source excludes `isDeleted` and hydrates relations manually (SandboxEntry has no Prisma relations to user/client/activity/task). `getSandboxDiff(label)` powers the sandbox diff tab.
- Finalized reports are stored as `MISReport.data` JSON snapshot (`isFinal: true`), so later timesheet edits don't change them.
- **Exports** (`lib/export.ts`): `MIS_COLUMNS` order must match the original Excel sheet exactly (listed in README). xlsx for Excel, jsPDF + autotable for PDF.

### UI

- `components/ui/*` are shadcn-style Radix wrappers; `cn()` from `lib/utils.ts`. `components/providers.tsx` wraps SessionProvider + React Query.
- Each portal's `layout.tsx` renders `components/shared/sidebar.tsx` (manager via `ManagerShell`); pages use `Topbar` + `PageHeader`. `RoleBadge` renders role labels consistently.
- Path alias `@/*` → repo root.
