# Ptex Management Dashboard

A fully secured, production-grade Timesheet & MIS Management System for **Ptex**, built with **Next.js 14 (App Router) + MySQL + Prisma**.

Two completely isolated portals — `/employee` for employees and `/manager` for staff (Managers, Admins, Super Admins):

| Role            | Portal   | Default capabilities |
|-----------------|----------|----------------------|
| **Employee**    | Employee | Submit / view their own timesheets only |
| **Manager**     | Manager  | Timesheets (view/edit/delete/approve/re-open), sandbox MIS, MIS reports, masters & activities, employees |
| **Admin**       | Manager  | Everything a Manager has, plus the Access Panel |
| **Super Admin** | Manager  | Full access; permissions can't be restricted. The last active Super Admin can't be demoted or deactivated |

Manager and Admin permissions can be customised per user from the **Access Panel**.

Employees can never see anything the Manager edits in the sandbox — sandbox data lives in a separate table and is never exposed via the employee API surface.

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

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your `.env`

Copy `.env.example` to `.env` and adjust:

```env
DATABASE_URL="mysql://root:password@localhost:3306/ptex_db"
NEXTAUTH_SECRET="replace-with-32-plus-character-random-string"
AUTH_SECRET="same-as-NEXTAUTH_SECRET"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
BCRYPT_ROUNDS=12
```

### 3. Run migrations and seed

```bash
npm run prisma:push     # creates tables in MySQL
npm run prisma:seed     # seeds masters, activities, tasks, demo users
```

### 4. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with one of the demo accounts:

| Role        | Email                        | Password    |
|-------------|------------------------------|-------------|
| Super Admin | superadmin@ptexsolutions.com | Admin@123   |
| Admin       | admin@ptexsolutions.com      | Admin@123   |
| Manager     | himanshu@ptexsolutions.com   | Manager@123 |
| Employee    | tqureshi@ptexsolutions.com   | Taha@123    |

> **Security:** the seeded Super Admin and Admin accounts use a publicly known password. On any non-development database, change their passwords immediately (or promote a real user to Super Admin and deactivate the seeded accounts).

---

## Project structure

```
app/
  (auth)/login/         Login screen
  employee/             Employee portal pages
  manager/              Manager portal pages
  api/                  REST API routes
components/
  ui/                   shadcn-style primitives
  shared/               Sidebar · Topbar · StatCard · PageHeader
  employee/             TimesheetForm · WeeklyGrid
  manager/              HoursChart and other manager components
app/manager/
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

### Manager portal
- **Dashboard** with KPIs and pending approval queue
- **All Timesheets** with filters (status, client, employee, date range)
- **Detail view** with approve/reject + rejection note
- **Sandbox MIS editor** — clone a date range into a named sandbox, then add/modify/soft-delete rows. Diff tab shows added/modified/removed
- **MIS Generator** — preview by employee, by client, detailed log, and 4 charts (pie, donut, bar by week, bar by employee). Finalize into a permanent MIS report
- **MIS report viewer** with Excel export matching the original sheet columns
- **Employee management** — CRUD with role assignment (you can only manage roles below your own)
- **Access Panel** — per-user permission matrix (view / edit / delete / approve / re-open / finalize per module) for Managers and Admins, highlighting overrides of role defaults; no one can grant a permission they don't hold
- **Masters** — generic CODE/Description CRUD for the six master types (Type, Client, Product, Version, Module, Cloud/On Prem)
- **Activities** — build an Activity by picking Client + Type + Product + Version + Module (+ optional Cloud/On Prem); the Activity ID (`CLIENT.MODULE.TYPE.VERSION.SEQ`) is generated automatically and immutable once created. Collapsible per-activity Task CRUD tree
- **Settings** — system overview

### Security
- All `/manager/*` and sensitive `/api/*` routes blocked by middleware to staff roles; every route handler additionally checks the specific module permission, resolved fresh from the database on each request
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
| `npm run dev`            | Start dev server (http://localhost:3000) |
| `npm run build`          | Generate Prisma client + production build |
| `npm run start`          | Run the production build           |
| `npm test`               | Run permission unit tests          |
| `npm run prisma:push`    | Push schema to MySQL (no migration files) |
| `npm run prisma:migrate` | Create + apply a migration         |
| `npm run prisma:seed`    | Seed masters, activities, tasks, users |
| `npm run prisma:studio`  | Open Prisma Studio                 |

---

## License

Internal Ptex use only.
