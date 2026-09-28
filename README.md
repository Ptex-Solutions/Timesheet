# Ptex Management Dashboard

A fully secured, production-grade Timesheet & MIS Management System for **Ptex**, built with **Next.js 14 (App Router) + MySQL + Prisma**.

Two completely isolated portals — `/employee` for employees and `/admin` for staff (Admins, Managers, Super Admins):

| Role            | Portal   | Default capabilities |
|-----------------|----------|----------------------|
| **Employee**    | Employee | Submit / view their own timesheets only |
| **Admin**       | Admin    | Timesheets (view/approve/re-open), sandbox MIS, MIS reports, masters, activities, employees |
| **Manager**     | Admin    | Everything an Admin has, plus the Access Panel; manages Admins |
| **Super Admin** | Admin    | Full access; permissions can't be restricted. The last active Super Admin can't be demoted or deactivated |

Admin and Manager permissions can be customised per user from the **Access Panel**.

Employees can never see anything staff edit in the sandbox — sandbox data lives in a separate table and is never exposed via the employee API surface.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) · TypeScript · Tailwind CSS
- **UI**: shadcn-style primitives, Radix UI, Lucide icons, sonner toasts
- **Database**: MySQL 8+ via Prisma
- **Auth**: NextAuth.js v5 (JWT credentials) with role-based middleware
- **State**: TanStack React Query
- **Charts**: Recharts
- **Exports**: xlsx (Excel) + jsPDF + jspdf-autotable (PDF)
- **Validation**: Zod (client + server)

---

## Getting started

**Full step-by-step guide: [SETUP.md](SETUP.md).** Short version (needs Node 18.17+ and Docker Desktop running):

```bash
npm install
npm run dev:up
```

`dev:up` does the following:

1. Creates `.env` with random secrets, if it's missing.
2. Starts a MySQL 8 container (`docker-compose.yml`, host port 3307), unless the database in `DATABASE_URL` is already reachable.
3. Applies migrations.
4. Seeds demo data, but only into an empty database.
5. Starts the dev server.

To use a MySQL you already run, set `DATABASE_URL` in `.env` and run the same command.

Open <http://localhost:3000> and sign in with one of the demo accounts:

| Role        | Email                        | Password    |
|-------------|------------------------------|-------------|
| Super Admin | superadmin@ptexsolutions.com | Admin@123   |
| Manager     | admin@ptexsolutions.com      | Admin@123   |
| Admin       | himanshu@ptexsolutions.com   | Manager@123 |
| Employee    | tqureshi@ptexsolutions.com   | Taha@123    |

> **Security:** the seeded Super Admin and Manager accounts use a publicly known password. On any non-development database, change their passwords immediately (or promote a real user to Super Admin and deactivate the seeded accounts).

---

## Project structure

```
app/
  (auth)/login/         Login screen
  employee/             Employee portal pages
  admin/                Admin portal pages (staff: Admin, Manager, Super Admin)
  api/                  REST API routes
components/
  ui/                   shadcn-style primitives
  shared/               Sidebar · Topbar · StatCard · PageHeader
  employee/             TimesheetForm · WeeklyGrid
  manager/              HoursChart and other manager components
app/admin/
  masters/              Masters admin screen (Type/Client/Product/Version/Module/Cloud-On-Prem CRUD)
  activities/            Activities admin screen (build an Activity from Masters, nested Task CRUD)
lib/
  auth.ts               NextAuth v5 setup
  prisma.ts             Prisma client singleton
  validations.ts        Zod schemas
  permissions.ts        Roles, permission catalogue, role defaults (pure)
  authz.ts              DB-resolved permissions (getCurrentAccess)
  api-utils.ts          requirePermission/requireUser + audit
  mis-engine.ts         MIS aggregation
  export.ts             Excel + PDF export
middleware.ts           Route protection by role
prisma/
  schema.prisma         Models
  seed.ts               Initial data
```

---

## Key features

### Employee portal
- **Dashboard** with weekly progress (Sat–Fri grid), monthly totals, recent entries
- **New entry** form mirroring the original Excel columns: Date, Client Code, Activity ID, Description, Hours, Type, Beeline Task, Task ID, PO Ref. Auto-derived: Week No., Week Label, Day, Minutes
- **My timesheets** list with edit/submit/delete on drafts only
- DRAFT/SUBMITTED/APPROVED/REJECTED status badges

### Admin portal
- **Dashboard** with KPIs and pending approval queue
- **All Timesheets** with filters (status, client, employee, date range)
- **Detail view** with approve/reject + rejection note
- **Sandbox MIS editor** — clone a date range into a named sandbox, then add/modify/soft-delete rows. Diff tab shows added/modified/removed
- **MIS Generator** — preview by employee, by client, detailed log, and 4 charts (pie, donut, bar by week, bar by employee). Finalize into a permanent MIS report
- **MIS report viewer** with Excel export matching the original sheet columns
- **Employee management** — CRUD with role assignment (you can only manage roles below your own)
- **Access Panel** — per-user permission matrix (view / edit / delete / approve / re-open / finalize per module) for Admins and Managers, highlighting overrides of role defaults; no one can grant a permission they don't hold
- **Masters** — generic CODE/Description CRUD for the six master types (Type, Client, Product, Version, Module, Cloud/On Prem)
- **Activities** — build an Activity by picking Client + Type + Product + Version + Module (+ optional Cloud/On Prem); the Activity ID (`CLIENT.MODULE.TYPE.VERSION.SEQ`) is generated automatically and immutable once created. Collapsible per-activity Task CRUD tree
- **Settings** — system overview

### Security
- All `/admin/*` and sensitive `/api/*` routes blocked by middleware to staff roles; every route handler additionally checks the specific module permission, resolved fresh from the database on each request
- Employee API queries always filtered server-side by `userId === session.user.id`
- Sandbox endpoints are staff-only — sandbox data never reaches employee tokens
- Every mutation writes to the `AuditLog` table
- Passwords hashed with bcrypt (configurable rounds)
- Zod validation on all API inputs

---

## Excel export columns (preserved exactly)

```
Month | Week No. | Week | Date | Resource | Role | Client Code | Activity ID |
Description | Hours | Type | Beeline Task / Project Activity Name | Task ID |
PO Ref. | Mins | SAT | SUN | MON | TUE | WED | THU | FRI | Day Count
```

---

## Useful scripts

| Command                  | Purpose                            |
|--------------------------|------------------------------------|
| `npm run dev:up`         | One-command setup + dev server (see SETUP.md) |
| `npm run dev`            | Start dev server only (http://localhost:3000) |
| `npm run db:setup`       | Setup (DB container, migrations, seed) without starting the app |
| `npm run db:up` / `db:down` | Start / stop the Docker MySQL container |
| `npm run db:seed`        | Add missing demo data (safe to re-run) |
| `npm run db:reset`       | ⚠️ Wipe the Docker database, recreate schema + demo data |
| `npm run build`          | Generate Prisma client + production build |
| `npm run start`          | Run the production build           |
| `npm test`               | Run unit tests (permissions, activity codes, entry dates) |
| `npm run prisma:push`    | Push schema to MySQL (no migration files) |
| `npm run prisma:migrate` | Create + apply a migration         |
| `npm run prisma:seed`    | Seed masters, activities, tasks, users |
| `npm run prisma:studio`  | Open Prisma Studio                 |

---

## License

Internal Ptex use only.
