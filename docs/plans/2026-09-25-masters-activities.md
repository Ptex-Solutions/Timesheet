# Generic Masters + Activity (formerly Project) — Implementation Plan

## Goal

Replace the flat `Client` / `Project` / `Task` model with:
1. A generic **Master** table (CODE + optional Description) covering six types: `TYPE`, `CLIENT`, `PRODUCT`, `VERSION`, `MODULE`, `CLOUD_ON_PREM`. One admin screen: pick a master type from a dropdown, CRUD the CODE/Description table below it.
2. An **Activity** (renamed from Project) built by picking Client + Type + Product + Version + Module (+ optional Cloud/On Prem) from those masters, plus a free-text description. Its `activityId` is auto-generated as `CLIENT.MODULE.TYPE.VERSION.SEQ`, e.g. `STC.ALL.CR.1.0.4390`, where `SEQ` is a global auto-increment starting at **4390**.
3. **Task** stays a child of Activity (taskId, taskName, poRef) — unchanged structurally, just re-parented.
4. Employee timesheet entry: pick **Client → Activity → Task**. Task drives `Beeline Task` (taskName) and `Type` (now read from the Activity's Type master, no longer a free dropdown) automatically. Employee still fills Date, Hours, Description.

## Decisions (made to keep moving — flag any that are wrong)

- `Client` becomes just another Master row (`type = CLIENT`); the dedicated `Client` model and `/manager/clients` page are removed. Existing FKs (`Timesheet.clientId`, `Activity.clientId`, `SandboxEntry.clientId`) point at `Master.id` where `type = CLIENT`.
- Activity ID segments are **immutable after creation** (Client/Type/Product/Version/Module can't be edited once the Activity exists — historical timesheets depend on the code). Description, Cloud/On Prem, and `isActive` remain editable.
- The sequence is **global** (one counter across all clients/types), continuing from 4390 regardless of what the wiped demo data had.
- Employee flow keeps an explicit **Task** picker (per your answer), filtered by the chosen Activity. `Type` on the timesheet is no longer a manual dropdown — it's read from `activity.type.code` (e.g. `CR`) and shown read-only.
- Wipe & reseed: the migration truncates `Timesheet`, `SandboxEntry`, `MISReport`, `Task`, `Project`, `Client` before altering structure; `prisma/seed.ts` is rewritten to create Masters, a handful of Activities, and Tasks under them. This is destructive to any current dev data — confirmed via your "Wipe & reseed" answer.
- The existing `clients` permission module (Access Panel row "Clients & Projects") is **reused and relabeled** to "Masters & Activities" and now gates both the Masters screen and the Activities screen — no new permission module, so the Access Panel and its API don't need structural changes, only the label in `lib/permissions.ts`.
- MIS export columns are unchanged in name/order; `Type` in the export now comes from the Activity's Type master code instead of the old freeform timesheet field.

## Data model

```prisma
enum MasterType {
  TYPE
  CLIENT
  PRODUCT
  VERSION
  MODULE
  CLOUD_ON_PREM
}

model Master {
  id          Int        @id @default(autoincrement())
  type        MasterType
  code        String
  description String?
  isActive    Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  activitiesAsClient  Activity[] @relation("ActivityClient")
  activitiesAsType    Activity[] @relation("ActivityType")
  activitiesAsProduct Activity[] @relation("ActivityProduct")
  activitiesAsVersion Activity[] @relation("ActivityVersion")
  activitiesAsModule  Activity[] @relation("ActivityModule")
  activitiesAsCloud   Activity[] @relation("ActivityCloud")
  timesheets  Timesheet[]     @relation("TimesheetClient")
  sandboxRows SandboxEntry[]  @relation("SandboxClient")

  @@unique([type, code])
  @@index([type])
}

model ActivitySequence {
  id      Int @id @default(1)
  current Int @default(4389) // next issued = current + 1
}

model Activity {
  id            Int      @id @default(autoincrement())
  activityId    String   @unique   // e.g. STC.ALL.CR.1.0.4390
  seq           Int      @unique   // 4390, 4391, ...
  name          String   // free-text description, e.g. "SUMM Cloud Development"

  clientId      Int
  client        Master   @relation("ActivityClient", fields: [clientId], references: [id])
  typeId        Int
  type          Master   @relation("ActivityType", fields: [typeId], references: [id])
  productId     Int
  product       Master   @relation("ActivityProduct", fields: [productId], references: [id])
  versionId     Int
  version       Master   @relation("ActivityVersion", fields: [versionId], references: [id])
  moduleId      Int
  module        Master   @relation("ActivityModule", fields: [moduleId], references: [id])
  cloudOnPremId Int?
  cloudOnPrem   Master?  @relation("ActivityCloud", fields: [cloudOnPremId], references: [id])

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tasks      Task[]
  timesheets Timesheet[]
  sandboxEntries SandboxEntry[] @relation("SandboxActivity")

  @@index([clientId])
  @@index([typeId])
}

model Task {
  id         Int      @id @default(autoincrement())
  taskId     String
  taskName   String
  poRef      String?
  activityId Int
  activity   Activity @relation(fields: [activityId], references: [id])
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  timesheets Timesheet[]

  @@index([activityId])
}
```

`Timesheet` and `SandboxEntry`: rename `projectId → activityId` (FK to `Activity`), keep `clientId` (FK to `Master`, `type=CLIENT` — set automatically from the chosen Activity, not independently picked... wait, employee DOES pick Client first as a filter. Client is still stored directly on the row (not derived only through Activity) for query/index parity with today. Keep both `clientId` and `activityId` on `Timesheet`/`SandboxEntry`; validate server-side that `activityId`'s `clientId` matches the submitted `clientId`.

## Task 1 — Schema, migration, seed, validations

Files: `prisma/schema.prisma`, new migration, `prisma/seed.ts`, `lib/validations.ts`.

- Add `MasterType` enum, `Master`, `Activity`, `ActivitySequence`, updated `Task`; rename FKs on `Timesheet`/`SandboxEntry`; drop `Client`, `Project` models.
- Migration must **first** delete existing rows in `Timesheet`, `SandboxEntry`, `MISReport`, `Task`, `Project`, `Client` (in FK-safe order) before the structural changes, since the old data can't map to the new shape. Seed reseeds everything (DB is dev-only per your answer).
- `ActivitySequence`: single row `{id:1, current:4389}` seeded once. Allocating the next number is `current += 1 RETURNING current` inside a transaction (see Task 2).
- `prisma/seed.ts`: create Master rows per type (suggested starter data — Type: CR, BAU, ENH, SUP; Client: STC, INT, ESN, FRL, LTP, FKG, VSI, ADI, IDLE (reuse existing client list as CLIENT masters); Product: SUM, COR, PORTAL; Version: 1.0, 2.0, 8.0, NA; Module: ALL, CORE, RPT; Cloud/On Prem: Cloud, On-Prem). Create 3-4 Activities via the generator (Task 2's function) with Tasks under them (reuse existing task/PO patterns like `STC/SOW/08OCT2025/01`). Keep demo Users as-is.
- `lib/validations.ts`: replace `clientSchema`/`projectSchema` with `masterSchema { type: z.enum(MASTER_TYPES), code, description optional, isActive }` and `activitySchema { name, clientId, typeId, productId, versionId, moduleId, cloudOnPremId optional, isActive }` (no `activityId`/`seq` — server-generated). `taskSchema.projectId` → `activityId`. `timesheetCreateSchema`: replace `projectId` with `activityId`, drop `type` (server derives it from the activity), keep `clientId` (validated against the activity's client server-side).

Verify: `npx prisma migrate dev --name masters_and_activities` applies cleanly (DB is reachable), `npx prisma generate`, `npm run prisma:seed`, `npx tsc --noEmit`.

## Task 2 — Activity code generation (`lib/activity-code.ts`) + tests

Pure formatting function `buildActivityId({ clientCode, moduleCode, typeCode, versionCode, seq }) → "STC.ALL.CR.1.0.4390"` (version formatting: strip trailing `.0`? No — keep as given, e.g. `"1.0"` stays `"1.0"`, `"NA"` stays `"NA"`; just join with `.` and uppercase codes). Node test file. This lives in a server file `lib/activity-service.ts` (impure, uses prisma) that:
- `allocateNextSeq(tx)`: `UPDATE ActivitySequence SET current = current + 1 WHERE id = 1` then read `current` back inside the same interactive transaction (same locking pattern as `app/api/users/route.ts`'s last-Super-Admin guard — avoid the race).
- `createActivity(input, tx?)`: loads the 5 required Masters (+ optional Cloud/On Prem) by id, verifies each is the right `type` and `isActive`, allocates a seq, builds the id via `buildActivityId`, `prisma.activity.create(...)`.
Export the pure `buildActivityId` (and any code-normalizing helper) from a file with no prisma import so it's independently testable; the service file imports it.

Verify: `npm test`, `npx tsc --noEmit`.

## Task 3 — Masters admin screen + API

Files: `app/api/masters/route.ts`, `app/manager/masters/page.tsx`, `app/manager/masters/panel.tsx` (client), `components/shared/manager-shell.tsx` (nav item), `lib/permissions.ts` (relabel `clients` module to "Masters & Activities").

- `GET /api/masters?type=CLIENT` (needs `clients.view`... i.e. the relabeled permission — code still uses key `"clients.view"` etc., only the display label changes) → list for that type ordered by code. `POST`/`PUT` need `clients.edit` (code uniqueness per type enforced — unique constraint + friendly 409/400 on violation). `DELETE` needs `clients.delete` — soft delete (`isActive:false`) if referenced by any Activity, else hard delete; block delete/deactivate of a Master that would leave an Activity's FK dangling (masters are never hard-deleted while referenced — just deactivate).
- Page: dropdown of the 6 master types at top (labels: Type, Client, Product, Version, Module, Cloud / On Prem), table below with CODE, Description, Active, actions — CRUD via a Dialog form, same shadcn patterns as `employees/manager.tsx`. Replaces the old `/manager/clients` nav entry (same href stays `/manager/masters`; update `manager-shell.tsx`'s "Clients & Projects" item to two items or one combined "Masters & Activities" dropdown/page — simplest: two nav items, "Masters" and "Activities" (Task 4), both gated on the same `clients.view` permission).

Verify: `npx tsc --noEmit`, `npm run build`.

## Task 4 — Activities admin screen + API (+ Task sub-CRUD)

Files: `app/api/activities/route.ts`, `app/api/activities/[id]/route.ts` (Task sub-CRUD nested here or `app/api/tasks/route.ts` updated), `app/manager/activities/page.tsx`, `app/manager/activities/manager.tsx` (client, adapts the old `clients/manager.tsx` tree UI), `app/manager/clients/**` deleted.

- `GET /api/activities` (`clients.view`) → activities with client/type/product/version/module/cloudOnPrem codes + task list. `POST` (`clients.edit`): body `{ name, clientId, typeId, productId, versionId, moduleId, cloudOnPremId? }`, calls `createActivity` from Task 2, returns the generated `activityId`. `PUT`: only `name`, `cloudOnPremId`, `isActive` editable (id-forming fields rejected with 400 if present and different). `DELETE` (`clients.delete`): soft only if it has timesheets, else hard delete.
- `app/api/tasks/route.ts`: `taskSchema.projectId` → `activityId`; unchanged otherwise.
- Page: left list/table of Activities (activityId, name, client, active toggle), "New Activity" dialog with 5 required + 1 optional Master dropdowns (fetched from `/api/masters?type=X` for each) and a live preview of the generated `activityId` pattern (`CLIENT.MODULE.TYPE.VERSION.####` — the real number is assigned server-side, so show `next` as a placeholder, e.g. fetch nothing extra, just show the pattern without the final number, or accept eventual-consistency and show the id returned after create). Selecting an Activity expands its Task list with the existing add/edit/soft-delete task UI (reuse `clients/manager.tsx` patterns).

Verify: `npx tsc --noEmit`, `npm run build`.

## Task 5 — Employee timesheet flow + timesheets API

Files: `app/api/timesheets/route.ts`, `app/api/timesheets/[id]/route.ts`, `components/employee/timesheet-form.tsx`, `components/employee/weekly-grid.tsx` (if it shows activity/type), `app/employee/timesheet/**page.tsx` (data fetching), `lib/mis-engine.ts`, `lib/export.ts`.

- Timesheet create/edit form: Client select (from `/api/masters?type=CLIENT`) → Activity select filtered by that client (`/api/activities?clientId=`) → Task select filtered by that activity (`activity.tasks`). On Task pick, show read-only `Type` (activity.type.code) and existing PO Ref display. Remove the manual Type `<Select>`. Fields: Date, Hours, Description stay manual.
- API: `timesheetCreateSchema`/`Update` use `activityId`, `clientId` (validated to match `activity.clientId`), `taskId` (validated to belong to the activity); server sets `type = activity.type.code` on create (stored on `Timesheet.type` as before, just sourced differently — keep the column, change where the value comes from).
- `lib/mis-engine.ts` / `lib/export.ts`: rename `project` relation → `activity`, `r.project?.activityId` stays the same field name conceptually; `type` continues to come from `r.type` (still stored on the row, just written by the server from the activity at creation time) — no column rename needed there.

Verify: `npx tsc --noEmit`, `npm run build`, manual read-through of the employee create/edit flow against the new schema.

## Task 6 — Sandbox, docs, final pass

Files: `app/api/sandbox/**`, `lib/mis-engine.ts` (sandbox hydration), `app/manager/sandbox/**`, `CLAUDE.md`, `README.md`.

- Sandbox entry create/edit: same Client → Activity → Task flow as Task 5; `sandboxEntrySchema` renames `projectId → activityId`; sandbox hydration in `generateMIS` looks up `Activity` instead of `Project`.
- `CLAUDE.md`: replace the "Timesheet domain model" hierarchy description (`Client → Project → Task`) with `Master → Activity → Task`, document the ID format and generator, the Masters/Activities screens, and that `clients.*` permissions now cover "Masters & Activities".
- `README.md`: update project structure and any Client/Project wording.
- Final: grep repo for leftover `Project`/`projectId`/`clientSchema`/`prisma.client\.` references outside this plan's intentional renames.

Verify: `npx tsc --noEmit`, `npm test`, `npm run build`.
