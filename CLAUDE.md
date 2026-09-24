# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Ptex Timesheet & MIS dashboard: Next.js 14 App Router + TypeScript + Prisma (MySQL) + NextAuth v5 (JWT credentials). Two portals: `/employee/*` (EMPLOYEE) and `/manager/*` (all *staff*: MANAGER, ADMIN, SUPER_ADMIN), with per-module permissions inside the manager portal.

## Commands

```bash
npm run dev              # dev server on http://localhost:3000
npm run build            # prisma generate + next build
npm run start            # run production build (or `node server.js`, custom HTTP server on :3000, dev:false)
npm run lint             # next lint
npm run prisma:push      # sync schema to DB without migration files (what README setup uses)
npm run prisma:migrate   # create + apply migration (prisma/migrations/)
npm run prisma:seed      # tsx prisma/seed.ts — clients/projects/tasks + demo users
npm run prisma:studio
npm test                 # node:test via tsx — lib/permissions.test.ts
npx tsc --noEmit         # typecheck (no separate script)
```

Tests use the built-in `node:test` runner (no Jest); only the pure permission logic is covered. No ESLint config is committed. Setup: copy `.env.example` → `.env` (`DATABASE_URL`, `NEXTAUTH_SECRET`/`AUTH_SECRET`, `AUTH_TRUST_HOST`, `BCRYPT_ROUNDS`). Demo logins are listed in README.md.

## Architecture

### Roles & permissions (RBAC)

- **Roles** (rank order): `EMPLOYEE < MANAGER < ADMIN < SUPER_ADMIN`. MANAGER/ADMIN/SUPER_ADMIN are **staff** (`STAFF_ROLES`, `isStaffRole`) and share the `/manager/*` portal.
- **Permission catalogue**: `lib/permissions.ts` — pure and edge-safe (no prisma/next imports; used by middleware, routes, server and client components). `MODULES` lists each module's actions (`view`/`edit`/`delete` plus specials `timesheets.approve`, `timesheets.reopen`, `mis.finalize`); `Permission` is the `"module.action"` union.
- **Effective permissions** = `roleDefaults(role)` + per-user overrides in `UserPermission { userId, module, action, granted }` (`resolvePermissions`). MANAGER defaults = everything except `access.*`; ADMIN/SUPER_ADMIN = everything. SUPER_ADMIN and EMPLOYEE ignore overrides. `diffOverrides(role, desired)` computes the minimal override rows for a desired set.
- **Resolved from the DB on every request**, never from the JWT (the JWT only carries `role` for middleware), so Access Panel changes apply immediately:
  1. **`middleware.ts`** gates coarsely by role: staff-only paths (`/manager`, `/api/sandbox`, `/api/mis`, `/api/users`, `/api/projects`, `/api/tasks`, `/api/access`). Update both that list and `matcher` when adding a protected route. `/api/clients` is intentionally not staff-only (employees need it for dropdowns).
  2. **Route handlers** call `requirePermission("module.action")` (or `requireStaff()`) from `lib/api-utils.ts`, which return `{ user, perms }` or a `NextResponse` (`requireUser()` returns just the session user) — `const a = await requirePermission(...); if (a instanceof NextResponse) return a;`.
  3. **Pages/layouts** call `getCurrentAccess()` (`lib/authz.ts`) and `redirect("/manager/dashboard")` when the page's `*.view` permission is missing. `app/manager/layout.tsx` passes `perms` to `components/shared/manager-shell.tsx`, whose `ITEMS` list gates each nav link on a permission; pages pass booleans like `canEdit` down to client components to hide actions.
- **Role management**: `canManageRole` (actor must outrank target; SUPER_ADMIN manages all). The **last active Super Admin** can't be demoted/deactivated — enforced atomically in `app/api/users/route.ts` (`FOR UPDATE` + recount inside a transaction).
- **Access Panel** (`/manager/access`, `app/api/access/*`, loader `lib/access-data.ts`): per-user permission matrix for MANAGER/ADMIN targets. Editing requires `access.edit` and `canEditAccess` (actor outranks target; SUPER_ADMIN/EMPLOYEE not editable). **No escalation**: an actor can't grant (or reset into) a permission they don't hold. Saves replace the user's override rows in one transaction and audit `permissions.update` / `permissions.reset`.

Session shape (`id: number`, `role`, `employeeCode`) is declared via module augmentation in `lib/auth.ts`; `lib/auth-handlers.ts` re-exports `handlers` for `app/api/auth/[...nextauth]`.

**Employee data scoping is enforced server-side**: when `role === "EMPLOYEE"`, handlers force `where.userId = user.id` and ignore any `userId` query param (see `app/api/timesheets/route.ts`). Preserve this in any new timesheet query.

### Data flow patterns

- **Reads**: most `page.tsx` files are async Server Components querying `prisma` directly (no API hop).
- **Writes**: client components (`*.tsx` siblings like `manager.tsx`, `form.tsx`, `editor.tsx`, `actions.tsx`, `approval-panel.tsx`) `fetch` the REST routes under `app/api/*`, toast via `sonner`, then `router.refresh()`. No server actions in use.
- **Every mutation** calls `audit({ userId, action, entity, entityId, meta })` → `AuditLog` table. `audit` swallows its own errors.
- Input validation: Zod schemas in `lib/validations.ts`, `safeParse` in handlers, 400 with `parsed.error.flatten()` on failure.

### Timesheet domain model

- Hierarchy: `Client` → `Project` (keyed by `activityId`) → `Task` (`taskId`, `poRef`). Timesheet references all three.
- **Week is Saturday–Friday**, not ISO Mon–Sun. `lib/utils.ts`: `weekLabelForDate` (e.g. `"06/09 - 12/09"`), `weekdayKey`, `dayCount`. `weekNo` however comes from `isoYearWeek` (ISO week number). Server derives `weekNo`, `weekLabel`, `minutes`, and the per-day columns (`sat`..`fri` — only the entry's own day is non-zero) on create/update; clients don't send them.
- Per-user per-day total hours capped at 24 (checked in POST handler).
- Status flow: `DRAFT → SUBMITTED → APPROVED | REJECTED`. Employees can edit/delete/submit only DRAFTs; staff with `timesheets.approve` approve/reject with `rejectionNote`. **Re-open** (`timesheets.reopen`) moves `APPROVED → DRAFT` (clears `approvedAt`/`submittedAt`/`rejectionNote`) and can't be combined with field edits in the same request.

### Sandbox & MIS

- **Sandbox** (`SandboxEntry`) is a staff-only scratch copy of timesheets grouped by string `sandboxLabel` (no separate sandbox table). Creating one clones real timesheets in a date range (`originalId` links back). Edits set `isAdded` / `isModified` / `isDeleted` (soft delete) flags; real `Timesheet` rows are never touched. Employees must never see sandbox data.
- **MIS engine** (`lib/mis-engine.ts`): `generateMIS({ source: "timesheets" | "sandbox", ... })` produces `MISData` (flat `rows` + `byEmployee`/`byClient`/`byType`/`byWeek`/`byEmployeePerWeek` aggregates). Timesheet source only includes `SUBMITTED` + `APPROVED`; sandbox source excludes `isDeleted` and hydrates relations manually (SandboxEntry has no Prisma relations to user/client/project/task). `getSandboxDiff(label)` powers the sandbox diff tab.
- Finalized reports are stored as `MISReport.data` JSON snapshot (`isFinal: true`), so later timesheet edits don't change them.
- **Exports** (`lib/export.ts`): `MIS_COLUMNS` order must match the original Excel sheet exactly (listed in README). xlsx for Excel, jsPDF + autotable for PDF.

### UI

- `components/ui/*` are shadcn-style Radix wrappers; `cn()` from `lib/utils.ts`. `components/providers.tsx` wraps SessionProvider + React Query.
- Each portal's `layout.tsx` renders `components/shared/sidebar.tsx` (manager via `ManagerShell`); pages use `Topbar` + `PageHeader`. `RoleBadge` renders role labels consistently.
- Path alias `@/*` → repo root.
