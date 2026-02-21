# WYKONCZYMY - Technical Spec & Implementation Plan

## Stack

- **Next.js 16.1.6** (App Router, Turbopack) + **Payload CMS 3.73.0** (embedded)
- **Postgres 17** via `@payloadcms/db-vercel-postgres`
  - **Local dev**: Docker container (Postgres 17-alpine)
  - **Production**: Neon (serverless Postgres)
- **Shadcn UI** + **Tailwind 4** for custom views
- **TanStack Table** for data tables (transfers, ledgers, reports)
- **Vercel** deployment + **Vercel Blob** or **Uploadthing** for invoice uploads
- **Docker Compose** for local dev environment (Postgres only — app runs on host via `next dev`)

---

## Spec Analysis & Critique

### Ambiguities in the spec

1. **"INNE" (OTHER) categories** - spec says "rozdzielić na podkategorię" but doesn't define them. Solution: a configurable `OtherCategories` collection managed by OWNER.
2. **"ZALICZKA NA POCZET WYPŁATY"** - zeroing out ZIUTEK sub-accounts by converting leftover balance to salary advance. This is a special transfer subtype under OTHER. Needs explicit handling.
3. A "cash register" becomes a **wallet/account** (can hold cash, process BLIK, etc.). The payment method is per-transfer, not per-register.
4. **"Invoice calculator"** for MANAGER - interpreted as: a form where MANAGER enters multiple invoice line items, auto-sums them, and creates the corresponding EMPLOYEE_EXPENSE transfer(s).
5. **Sub-account balance** - not a separate entity. Computed from `SUM(ADVANCE) - SUM(EMPLOYEE_EXPENSE)` filtered by worker. Stored as virtual field, recalculated on each transfer.

### Design decisions

- **No separate SubAccounts collection.** EMPLOYEE balance = sum of their ACCOUNT_FUNDING transfers minus sum of their EMPLOYEE_EXPENSE transfers. Simpler, no sync issues.
- **Investment totalCosts** = computed via hooks on transfer CRUD, stored on the Investment document for fast reads. (May evolve to signed P&L balance in M28 — deferred.)
- **CashRegister balance** = computed via hooks on transfer CRUD, stored on the register document.
- **All money flows are transfers.** Register-to-register transfer = single `REGISTER_TRANSFER` transfer with source + target registers.
- **EMPLOYEE_EXPENSE does NOT touch cash registers.** When a worker spends their advanced money, only their saldo decreases and investment costs increase. The cash register already lost the money when the advance was given. This prevents double-charging.
- **Deposit types are explicit.** Instead of a generic `DEPOSIT`, each source of funds is a separate transfer type (`INVESTOR_DEPOSIT`, `STAGE_SETTLEMENT`, `COMPANY_FUNDING`, `OTHER_DEPOSIT`) with appropriate required fields.

---

## Data Model (Payload Collections)

### 1. Users (auth collection)

| Field | Type   | Notes                                                 |
| ----- | ------ | ----------------------------------------------------- |
| name  | text   | required                                              |
| email | email  | required, unique                                      |
| role  | select | `ADMIN` / `OWNER` / `MANAGER` / `EMPLOYEE`, saveToJWT |

**Role semantics:**

- `ADMIN` — Full system access. Payload admin panel, all collections, user management, system config. Reserved for developers/sysadmins.
- `OWNER` — Business owner (SZEF). Full CRUD on all business data. Cannot access Payload admin panel system settings.
- `MANAGER` — Site manager (MAJSTER). Creates transfers, views all data, manages own cash register.
- `EMPLOYEE` — Worker (ZIUTEK). Read-only access to own sub-account and transfers.

### 2. CashRegisters

| Field   | Type         | Notes                                         |
| ------- | ------------ | --------------------------------------------- |
| name    | text         | e.g. "Kasa Adrian", "Kasa Bartek"             |
| owner   | relationship | → Users                                       |
| balance | number       | updated via hooks, default 0, admin read-only |

### 3. Investments

| Field         | Type     | Notes                        |
| ------------- | -------- | ---------------------------- |
| name          | text     | client/project name          |
| address       | text     |                              |
| phone         | text     |                              |
| email         | email    | optional                     |
| contactPerson | text     |                              |
| notes         | textarea |                              |
| totalCosts    | number   | updated via hooks, default 0 |
| status        | select   | `active` / `completed`       |

### 4. Transactions

| Field            | Type         | Notes                                                                                                                                            |
| ---------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| description      | text         | what the money was spent on                                                                                                                      |
| amount           | number       | always positive, direction determined by type                                                                                                    |
| date             | date         | when the transfer occurred                                                                                                                       |
| type             | select       | See type enum table in M24. Current: `DEPOSIT` / `INVESTMENT_EXPENSE` / `ADVANCE` / `EMPLOYEE_EXPENSE` / `OTHER`. Post-M24: expanded to 9 types. |
| paymentMethod    | select       | `CASH` / `BLIK` / `TRANSFER` / `CARD`                                                                                                            |
| cashRegister     | relationship | → CashRegisters (source of funds). **Not used for EMPLOYEE_EXPENSE** (post-M24).                                                                 |
| targetRegister   | relationship | → CashRegisters (post-M24, only for REGISTER_TRANSFER)                                                                                           |
| investment       | relationship | → Investments (required for some types, optional for EMPLOYEE_EXPENSE)                                                                           |
| worker           | relationship | → Users (required if type = ACCOUNT_FUNDING or EMPLOYEE_EXPENSE)                                                                                 |
| invoice          | upload       | → Media                                                                                                                                          |
| invoiceNote      | textarea     | optional, never required                                                                                                                         |
| otherCategory    | relationship | → OtherCategories (required if type = OTHER)                                                                                                     |
| otherDescription | textarea     | required if type = OTHER and category not in predefined list                                                                                     |
| createdBy        | relationship | → Users, auto-set via hook                                                                                                                       |

### 5. OtherCategories

| Field | Type | Notes                      |
| ----- | ---- | -------------------------- |
| name  | text | e.g. "Paliwo", "Narzędzia" |

### 6. Media (Payload built-in)

For invoice file uploads (PDF, images).

---

## Hooks (Business Logic)

### Transfers - beforeValidate

- Auto-set `createdBy` from `req.user`
- Type-dependent required fields — see M24 type table for full matrix. Key rules:
  - Deposit types (`INVESTOR_DEPOSIT`, `STAGE_SETTLEMENT`) → require `cashRegister` + `investment`
  - `COMPANY_FUNDING`, `OTHER_DEPOSIT` → require `cashRegister`
  - `INVESTMENT_EXPENSE` → require `cashRegister` + `investment`
  - `ACCOUNT_FUNDING` → require `cashRegister` + `worker`
  - `EMPLOYEE_EXPENSE` → require `worker`, NO cash register. `investment` optional (relaxed in M27).
  - `REGISTER_TRANSFER` → require `cashRegister` (source) + `targetRegister`
  - `OTHER` → require `cashRegister` + `otherCategory`

### Transfers - afterChange (create/update/delete)

- Recalculate `cashRegister.balance` — **skip for EMPLOYEE_EXPENSE** (no register involved)
- For `REGISTER_TRANSFER` → recalculate BOTH source (`cashRegister`) and target (`targetRegister`) balances
- If type has `investment` → recalculate `investment.totalCosts`
- Worker sub-account balance is computed on-read (no stored field needed)

### Transfers - beforeDelete

- Reverse all balance effects before allowing deletion (or disallow deletion, only allow corrections via new transfers — safer for accounting)

---

## Access Control

| Collection      | ADMIN       | OWNER       | MANAGER                          | EMPLOYEE                 |
| --------------- | ----------- | ----------- | -------------------------------- | ------------------------ |
| Users           | full CRUD   | full CRUD   | create (EMPLOYEE only), read all | read self only           |
| CashRegisters   | full CRUD   | full CRUD   | read all, update own balance     | no access                |
| Investments     | full CRUD   | full CRUD   | read all                         | no access                |
| Transactions    | full CRUD   | full CRUD   | create, read all, update own     | read own (worker = self) |
| OtherCategories | full CRUD   | full CRUD   | read                             | no access                |
| Media           | full CRUD   | full CRUD   | create, read                     | read own                 |
| Payload Admin   | full access | full access | full access                      | no access                |

---

## Custom Views (Next.js App Router pages, outside Payload admin)

1. **Dashboard** (`/`) — cash register balances, recent transfers, quick stats
2. **Investments** (`/investments`, `/investments/[id]`) — list + detail with transfer table
3. **Cash Registers** (`/cash-registers`, `/cash-registers/[id]`) — balance, transfer history
4. **Workers** (`/workers`, `/workers/[id]`) — sub-account balance, advance/expense history
5. **Settlement** (`/settlement`) — MANAGER enters EMPLOYEE invoices, calculator, creates EMPLOYEE_EXPENSE batch
6. **New Transfer** (`/transfers/new`) — form with conditional fields based on type
7. **Reports** (`/reports`) — filterable by date range, investment, worker, register
8. **Worker Portal** (`/my-account`) — read-only view of own sub-account for EMPLOYEE role

---

## Implementation Milestones

### M1: Project Scaffold ✅ DONE

- [x] Switch from npm to pnpm
- [x] Move to `src/` directory structure (`@/*` → `./src/*`)
- [x] Reorganize `app/` into route groups: `(frontend)` + `(payload)`
- [x] Merge root layout + slug layout into `(frontend)/layout.tsx`
- [x] Install Payload CMS 3.73.0 (compatible with Next.js 16.1.6 + Turbopack)
- [x] Create `payload.config.ts` with Users collection + Postgres adapter
- [x] Wire `next.config.ts` with `withPayload`
- [x] Create `(payload)` route files from blank template (layout, page, not-found, API routes)
- [x] Docker Compose for local Postgres 17
- [x] Update `.env` with `DATABASE_URL` + `PAYLOAD_SECRET`
- [x] Add `"type": "module"` to `package.json` (required for Payload CLI on Node 24)
- [x] Generate import map + types
- [x] Create initial migration + run it
- **Key files**: `src/payload.config.ts`, `next.config.ts`, `docker-compose.yml`, `src/app/(payload)/`, `src/app/(frontend)/layout.tsx`
- **Verified**: Frontend (200) + Admin panel (200) both working on Turbopack

#### Deferred from M1

- Email adapter (nodemailer) — console-only for now, add when needed
- Admin panel i18n (pl/en) — add in M2
- CORS config — add when frontend fetches from API

---

### M2: Auth & Users ✅ DONE

- [x] Extract Users collection to `src/collections/users.ts`
- [x] Add role field (`ADMIN` / `OWNER` / `MANAGER` / `EMPLOYEE`) with `saveToJWT`
- [x] Role-based access control helpers (`src/access/`)
- [x] ADMIN role: full Payload admin panel access, all collections unrestricted
- [x] Seed script for initial ADMIN account (`onInit` hook, skips if users exist)
- [x] Admin panel i18n (`@payloadcms/translations` — pl + en, fallback: pl)
- [x] Collection labels + field labels translated (pl/en)
- [x] Existing user (Konrad) promoted to ADMIN role
- **Key files**: `src/collections/users.ts`, `src/access/index.ts`, `src/seed.ts`, `src/payload.config.ts`
- **Migration**: `20260211_204911_add_user_role.ts`
- **Verified**: Admin panel (200), frontend (200), Polish translations active, access control blocking anonymous requests

### M3: Core Collections (CashRegisters, Investments, OtherCategories) ✅ DONE

- [x] CashRegisters with owner relationship and balance field
- [x] Investments with all client fields and totalCosts
- [x] OtherCategories for configurable expense categories
- [x] Media collection for invoice uploads (images + PDF, with createdBy auto-set)
- **Files**: `src/collections/cash-registers.ts`, `src/collections/investments.ts`, `src/collections/other-categories.ts`, `src/collections/media.ts`
- **Migration**: `20260211_212425.ts`
- **Verified**: All 4 tables created, types generated, frontend (200) + admin (200)

### M4: Transfers & Business Logic ✅ DONE

- [x] Transfers collection with all fields and conditional visibility (`admin.condition`)
- [x] Validation hooks (beforeValidate) — type-dependent required fields, auto-set createdBy
- [x] Balance update hooks (afterChange + afterDelete) — recalculate register balance and investment totalCosts
- [x] Invoice upload via Media collection (configured in M3)
- [x] Refactored access control — extracted `rolesOrSelfField` higher-order helper, eliminated all inline access logic across 4 collections
- **Files**: `src/collections/transfers.ts`, `src/hooks/transfers/validate.ts`, `src/hooks/transfers/recalculate-balances.ts`, `src/access/index.ts`
- **Migration**: `20260211_213603.ts`
- **Verified**: Types generated, frontend (200) + admin (200)

### M5: Dashboard & Sidebar Layout ✅ DONE

- [x] Sidebar layout with role-based navigation (EMPLOYEE sees Kokpit + Transakcje only)
- [x] Dashboard with overview cards (register balances, active investments, recent transfers)
- [x] Login/logout flow with session-based auth
- **Files**: `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/page.tsx`, `src/components/layouts/sidebar/sidebar.tsx`, `src/app/(auth)/`
- **Verified**: Frontend (200), sidebar renders, auth redirect works

### M6: Frontend Business Features ✅ DONE

- [x] Shared constants (`src/lib/constants/transfers.ts`) — type/payment labels, conditional field helpers
- [x] Role permission helpers (`src/lib/auth/permissions.ts`) — `isManagementRole()`, `MANAGEMENT_ROLES`
- [x] Role-aware sidebar — EMPLOYEE sees 2 items, management sees 5 + "Nowa transakcja" button
- [x] Role-aware dashboard — management sees full stats, EMPLOYEE sees personal saldo + monthly transfers
- [x] Employee dashboard with month/year selector and server action data fetching
- [x] Transfer creation dialog (openable from sidebar/list page) with context provider pattern
- [x] Transfer form with conditional fields, Zod 4 validation, invoice upload, server action
- [x] Transfer list page (`/transakcje`) with URL-based filters (type, cash register, date range) + pagination
- [x] EMPLOYEE auto-filtered to own transfers on list page
- **New files**: `src/lib/constants/transfers.ts`, `src/lib/auth/permissions.ts`, `src/lib/actions/transfers.ts`, `src/lib/schemas/transfers.ts`, `src/app/(frontend)/_components/manager-dashboard.tsx`, `src/app/(frontend)/_components/employee-dashboard.tsx`, `src/app/(frontend)/_components/layout-shell.tsx`, `src/components/transfers/transfer-dialog-provider.tsx`, `src/components/transfers/transfer-form.tsx`, `src/app/(frontend)/transakcje/page.tsx`, `src/app/(frontend)/transakcje/_components/`
- **Modified**: `src/components/layouts/sidebar/sidebar.tsx`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/layout.tsx`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), dev server running

### M7: Investment, Cash Register & Worker Views ✅

- [x] Investment list + detail page with transfer history
- [x] Cash register list + detail with balance and transfer history
- [x] Worker list + sub-account balance view
- **New files**: `src/app/(frontend)/inwestycje/page.tsx`, `src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/app/(frontend)/kasa/page.tsx`, `src/app/(frontend)/kasa/[id]/page.tsx`, `src/app/(frontend)/uzytkownicy/page.tsx`, `src/app/(frontend)/uzytkownicy/[id]/page.tsx`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 new errors)
- **Success**: All sidebar pages have functional views with real data

### M8: Settlement Flow ✅ DONE

- [x] Settlement server actions: `getEmployeeSaldo`, `createSettlement`, `zeroSaldoAction`
- [x] Settlement page (`/rozliczenia`) — management-only, fetches reference data
- [x] Settlement form with dynamic line items, auto-sum, employee saldo display, invoice upload
- [x] Each line item creates a separate EMPLOYEE_EXPENSE transfer (shared metadata: worker, investment, date, cash register, payment method, invoice)
- [x] Zero saldo dialog on `/uzytkownicy/[id]` — creates single EMPLOYEE_EXPENSE to zero out balance
- [x] Sidebar: "Rozliczenia" nav item (management only, Receipt icon)
- **New files**: `src/lib/settlements/actions.ts`, `src/app/(frontend)/rozliczenia/page.tsx`, `src/components/settlements/settlement-form.tsx`, `src/components/settlements/zero-saldo-dialog.tsx`
- **Modified**: `src/components/layouts/sidebar/sidebar.tsx`, `src/app/(frontend)/uzytkownicy/[id]/page.tsx`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 new errors)

---

### M8.1: Form Defaults & Manager Cash Register Scoping ✅ DONE

- [x] Default payment method to CASH in settlement + zero-saldo forms
- [x] Manager's own cash register pre-selected and locked (disabled select) in transfer/settlement/zero-saldo forms
- [x] ADMIN/OWNER can freely choose any cash register
- [x] Server-side: `getUserCashRegisterIds()` resolves Manager's own register
- **Files**: `src/lib/auth/get-user-cash-registers.ts`, `src/components/settlements/settlement-form.tsx`, `src/components/settlements/zero-saldo-dialog.tsx`, `src/components/transfers/transfer-form.tsx`

#### Note: Adding workers & investments

Adding new workers (Users) and investments is handled exclusively via the **Payload admin panel** — no frontend forms needed. MANAGER can create EMPLOYEE users only (role field locked to default); ADMIN/OWNER can create users with any role.

### M8.2: Refactoring & Dashboard Improvements ✅ DONE

- [x] Login form — migrated to TanStack Form (`useAppForm`), removed redundant client-side Zod validation, added `autoComplete` support to form system
- [x] Employee dashboard — split saldo into overall (fetched once on server) + monthly (refetched on month/year change via server action)
- [x] Employee dashboard — extracted server component (`employee-dashboard-server.tsx`), cleaned up `page.tsx` to pure routing
- [x] Employee dashboard — optimized from 5 Payload queries to 2 (combined ADVANCE + EMPLOYEE_EXPENSE with `select` projection)
- [x] Employee dashboard — removed month/year from URL params, now client state with `useTransition` + server action
- [x] StatCard — extracted as shared reusable component used by both employee and manager dashboards
- [x] Admin panel access — ADMIN + OWNER + MANAGER can now access `/admin` (EMPLOYEE still locked out)
- **New files**: `src/components/ui/stat-card.tsx`, `src/app/(frontend)/_components/employee-dashboard-server.tsx`, `src/lib/queries/get-employee-dashboard.ts`
- **Modified**: `src/app/(auth)/zaloguj/login-form.tsx`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/_components/employee-dashboard.tsx`, `src/app/(frontend)/_components/manager-dashboard.tsx`, `src/components/forms/types/form-types.ts`, `src/components/forms/form-input.tsx`, `src/access/index.ts`, `src/collections/users.ts`

### M9: Performance Optimization — SQL SUM Aggregation ✅ DONE

Replaced all fetch-all-and-reduce-in-JS patterns with Postgres `SUM()` queries. No new dependencies — uses `sql` re-exported from `@payloadcms/db-vercel-postgres`.

- [x] **Shared SQL utility** (`src/lib/db/sum-transfers.ts`) — `getDb` helper for transaction-scoped Drizzle access + 4 aggregation functions:
  - `sumRegisterBalance(payload, registerId, req?)` — `SUM(CASE WHEN DEPOSIT THEN +amount ELSE -amount END)`
  - `sumInvestmentCosts(payload, investmentId, req?)` — `SUM(amount)` for `INVESTMENT_EXPENSE` + `EMPLOYEE_EXPENSE`
  - `sumEmployeeSaldo(payload, workerId, dateRange?)` — `SUM(CASE WHEN ADVANCE THEN +amount ELSE -amount END)` with optional date range
  - `sumAllWorkerSaldos(payload)` — same as above but `GROUP BY worker_id`, returns `Map<number, number>`
- [x] **`recalculate-balances.ts` hooks** — replaced `payload.find(limit: 0)` + `.reduce()` with `sumRegisterBalance` / `sumInvestmentCosts`. `req` forwarded for transaction-scoped DB access (DB transaction, not business transfer).
- [x] **`get-employee-dashboard.ts`** — `getEmployeeSaldo`: replaced 2x `payload.find(limit: 0)` + reduce → single `sumEmployeeSaldo`. `getEmployeeMonthlyData`: replaced monthly saldo fetch + loop → `sumEmployeeSaldo` with date range.
- [x] **`settlements/actions.ts`** — `getEmployeeSaldo`: replaced 2x `payload.find(limit: 1000)` + reduce → `sumEmployeeSaldo`. **Fixed limit:1000 truncation bug.**
- [x] **`actions/transfers.ts`** — `getEmployeeMonthData`: replaced 2x `payload.find(limit: 1000)` + reduce → single `sumEmployeeSaldo`. Dropped 2 of 3 parallel queries. **Fixed limit:1000 truncation bug.**
- [x] **`uzytkownicy/[id]/page.tsx`** — replaced 2x `payload.find(pagination: false)` + reduce → single `sumEmployeeSaldo`. Dropped 2 of 6 parallel queries.
- [x] **`uzytkownicy/page.tsx`** — replaced 2x full-table scans (`pagination: false`, no worker filter) + JS grouping → single `sumAllWorkerSaldos` with `GROUP BY`. Dropped 2 of 3 parallel queries.
- **New file**: `src/lib/db/sum-transfers.ts`
- **Modified**: `src/hooks/transfers/recalculate-balances.ts`, `src/lib/queries/get-employee-dashboard.ts`, `src/lib/actions/settlements.ts`, `src/lib/actions/transfers.ts`, `src/app/(frontend)/uzytkownicy/page.tsx`, `src/app/(frontend)/uzytkownicy/[id]/page.tsx`
- **Verified**: `pnpm tsc --noEmit` (0 new errors)

#### Deferred from M9

- **Searchable combobox** — sidebar/forms fetch all users/investments/categories upfront with `pagination: false`. Won't scale past ~100-200 records, but fine for a construction company with <50 workers, <100 investments, <10 registers. Defer to a later milestone if growth warrants it.

### Bug Fixes (post-M9)

- [x] **Pagination not navigating** — `UrlPagination` called `e.preventDefault()` unconditionally, blocking `<Link>` navigation when `onNavigate` wasn't passed. Made `handleClick` conditional.
- [x] **Pagination page windowing** — all page buttons rendered (e.g. 20 buttons). Replaced with 5-page sliding window + first/last page buttons + configurable jump-by-N arrows (`jumpSize` prop, default 5). New utility: `src/components/ui/pagination/get-windowed-pages.ts`.
- [x] **MANAGER privilege escalation** — MANAGER could create users with any role (ADMIN, OWNER). Added `create: isAdminOrOwnerField` to role field; restricted collection `update`/`delete` to `isAdminOrOwner`. MANAGER can now only create EMPLOYEE users (role field defaults when not writable).

### M10: Mobile Navigation UX ✅ DONE

- [x] Increased hamburger button touch target (`p-2.5` → `p-3`, 48px)
- [x] Increased Sheet close button touch target (`p-1.5`, icon `size-4` → `size-6`)
- [x] Added Framer Motion animations to mobile nav drawer (overlay fade + panel slide-from-left via `AnimatePresence` + `motion.div`)
- [x] Kept Radix Dialog for accessibility (focus trap, escape, aria), disabled its CSS animations
- **Modified**: `src/components/layouts/mobile-nav.tsx`, `src/components/layouts/mobile-menu-toggle.tsx`, `src/components/ui/sheet.tsx`

### M11: Cache + Revalidation ✅ DONE

- [x] Cache infrastructure: `src/lib/cache/tags.ts` (tag constants), `src/lib/cache/revalidate.ts` (revalidation helpers)
- [x] Hook factory: `src/hooks/revalidate-collection.ts` — shared `afterChange`/`afterDelete` hooks calling `revalidateCollection()`
- [x] Wrapped expensive fetches with `unstable_cache`: navigation reference data (4 collection tags), all worker saldos, individual employee saldo
- [x] Replaced `revalidatePath()` with `revalidateCollections()` in server actions (`actions/transfers.ts`, `actions/settlements.ts`)
- [x] Added revalidation hooks to all 5 collection configs (cash-registers, investments, users, other-categories, transactions)
- [x] Extracted `ROLES`/`RoleT`/`ROLE_LABELS` from `users.ts` into `src/lib/auth/roles.ts` to break server→client import chain
- **New files**: `src/lib/cache/tags.ts`, `src/lib/cache/revalidate.ts`, `src/hooks/revalidate-collection.ts`, `src/lib/auth/roles.ts`
- **Modified**: 12+ files (navigation, pages, actions, hooks, collections)

### M12: Session Duration ✅ DONE

- [x] Extended Payload session from default 2h to 24h (`auth: { tokenExpiration: 86400 }`)
- **Modified**: `src/collections/users.ts`

### M13: Deployment ✅ DONE

- [x] Vercel project setup
- [x] Neon Postgres provisioning + data migrated
- [x] File storage — Vercel Blob via `@payloadcms/storage-vercel-blob@3.73.0`, configured in `payload.config.ts` plugin. Requires `BLOB_READ_WRITE_TOKEN` env var.
- [x] Production build verification — `pnpm build` succeeds. Fixed dead `format-date.ts` (removed) and seed script type errors (`type`/`paymentMethod` widened to `string` instead of literal unions).
- [x] Email adapter — `@payloadcms/email-nodemailer@3.73.0` + `nodemailer` with SMTP (seohost.pl). Requires `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` env vars.
- [x] Environment variables audit — ensure all env vars are set in Vercel (`DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`)
- [x] Test email route (`GET /api/test-email?to=...`) — ADMIN-only, verifies SMTP connection before sending
- **New deps**: `@payloadcms/storage-vercel-blob@3.73.0`, `@payloadcms/email-nodemailer@3.73.0`, `nodemailer`, `@types/nodemailer` (dev)
- **Modified**: `src/payload.config.ts`, `src/scripts/seed-transfers.ts`, `src/scripts/seed-ziutek-advances.ts`
- **Deleted**: `src/lib/format-date.ts` (dead code, referenced deleted i18n module)
- **Success**: App live on Vercel, all features working

---

### M14: Centralized Query Layer + lib/ Cleanup ✅ DONE

- [x] Shared pagination helper (`src/lib/pagination.ts`) — `parsePagination()`, `buildPaginationMeta()`, constants
- [x] Query files: `src/lib/queries/` — transfers, investments, cash-registers, users, employees, reference-data
- [x] All queries self-contained — each creates own Payload instance, wrapped with `unstable_cache` + tag-based invalidation
- [x] Pages no longer manage Payload instances — just call cached query functions
- [x] Server actions consolidated into `src/lib/actions/` (auth, transfers, settlements)
- [x] Table configs consolidated into `src/lib/tables/` (one file per entity: type + columns + mapper)
- [x] Schemas moved to `src/lib/schemas/` (transfers)
- [x] Navigation `fetchReferenceData` moved to `src/lib/queries/reference-data.ts`
- [x] `getUserCashRegisterIds` wrapped with `unstable_cache`
- [x] Inline `payload.find()` calls in pages replaced with proper cached query functions
- [x] Dead code removed: `getEmployeeMonthData`, `EmployeeMonthDataT`, `SerializedTransferT`
- **Final `src/lib/` structure**:
  ```
  lib/
  ├── actions/       (auth.ts, transfers.ts, settlements.ts)
  ├── auth/          (get-current-user.ts, get-user-cash-registers.ts, permissions.ts, roles.ts)
  ├── cache/         (tags.ts, revalidate.ts)
  ├── constants/     (transfers.ts)
  ├── db/            (sum-transfers.ts)
  ├── queries/       (transfers.ts, cash-registers.ts, investments.ts, users.ts, employees.ts, employee-data.ts, reference-data.ts, media.ts)
  ├── schemas/       (transfers.ts)
  ├── tables/        (transfers.tsx, cash-registers.tsx, investments.tsx, users.tsx)
  └── [utilities]    (cn.ts, env.ts, pagination.ts, format-currency.ts)
  ```
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors)

---

### M15: Migrate `unstable_cache` → `use cache` Directive ✅ DONE

- [x] Enabled `cacheComponents: true` in `next.config.ts`
- [x] Migrated all query functions from `unstable_cache` wrapper → `'use cache'` directive + `cacheTag()` inside function body
- [x] Removed manual `keyParts` arrays — cache key derived from function arguments automatically
- [x] Split `employees.ts` (`'use server'`) — cached data functions moved to new `src/lib/queries/employee-data.ts` (`'use cache'`), server action wrappers remain in `employees.ts`
- [x] `revalidateTag()` in actions and hooks unchanged — works identically with `use cache`
- **Modified**: `next.config.ts`, `src/lib/queries/transfers.ts`, `src/lib/queries/cash-registers.ts`, `src/lib/queries/investments.ts`, `src/lib/queries/users.ts`, `src/lib/queries/employees.ts`, `src/lib/queries/reference-data.ts`, `src/lib/auth/get-user-cash-registers.ts`
- **New file**: `src/lib/queries/employee-data.ts`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors)

### M16: Table Column Management ✅ DONE

- [x] Column visibility toggle — `src/components/ui/column-toggle.tsx` dropdown with `Settings2` icon, respects `meta.canHide` and `meta.label`
- [x] Column definition meta — `src/lib/tables/column-meta.ts` augments TanStack Table with `label` and `canHide` properties
- [x] Persist visibility to localStorage — `src/components/ui/data-table.tsx` reads/writes `table-columns:{storageKey}` key
- [x] Applied to transfer and investment tables with `storageKey` prop
- [x] Clickable table rows — whole row is a navigable link where relevant
- [x] Dropdown stays open on checkbox toggle (`onSelect` with `preventDefault`)
- **New files**: `src/components/ui/column-toggle.tsx`, `src/lib/tables/column-meta.ts`
- **Modified**: `src/components/ui/data-table.tsx`, table column definitions in `src/lib/tables/`

### M16.1: Settlement Form Refactor — TanStack Form + Per-Line Invoices ✅ DONE

- [x] Settlement Zod schemas — client (string values) + server (typed) for both settlement and zero-saldo forms
- [x] Settlement server actions refactored — `createSettlementAction(data, invoiceFormData)` and `zeroSaldoAction(data)` accept typed data instead of raw FormData, with schema validation via `safeParse`
- [x] Settlement form rewritten with `useAppForm` — TanStack Form array fields (`form.Field mode="array"` + `pushValue`/`removeValue`) for line items, `form.AppField` for all other fields, `useStore` for reactive total, `listeners.onChange` on worker field for saldo fetch, `useFormStatus` for submit/invalid state, `useCheckFormErrors` for dev debugging
- [x] Per-line-item invoice uploads — each line item row has its own file input, files tracked via `useRef<Map<number, File>>`, re-indexed on row removal, sent as `invoice-0`, `invoice-1`, ... in FormData
- [x] Server action handles per-line files — uploads each file separately to media collection, links each transfer to its own mediaId
- [x] Global `invoiceNote` as fallback — each line item must have either its own file OR the global note
- [x] Zero-saldo dialog rewritten with `useAppForm` — same TanStack Form pattern, `zeroSaldoFormSchema` validation, typed submit handler
- [x] Client-side field-level error display (was toast-only before)
- **New file**: `src/lib/schemas/settlements.ts`
- **Modified**: `src/lib/actions/settlements.ts`, `src/components/settlements/settlement-form.tsx`, `src/components/settlements/zero-saldo-dialog.tsx`

- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 new errors)

### M17: Worker Monthly Report ✅ DONE

- [x] `TransferFilters` extracted to shared location (`src/components/transfers/transfer-filters.tsx`) with configurable `baseUrl` prop
- [x] `sumWorkerPeriodBreakdown` SQL aggregation in `src/lib/db/sum-transfers.ts` — advances, expenses, net saldo for worker in date range
- [x] Cached `getWorkerPeriodBreakdown` query wrapper in `src/lib/queries/users.ts`
- [x] `findAllTransfersRaw` query (no pagination) for print route
- [x] Filters + period stats on worker detail page (`/uzytkownicy/[id]`) — date range, type, cash register, investment filters with period breakdown cards
- [x] Print route at `/uzytkownicy/[id]/raport` — server-rendered, full transfer table, summary stats, print button
- [x] Print styles in `globals.css` — hides nav/sidebar for clean print output
- **Files**: `src/components/transfers/transfer-filters.tsx`, `src/lib/db/sum-transfers.ts`, `src/lib/queries/users.ts`, `src/lib/queries/transfers.ts`, `src/app/(frontend)/uzytkownicy/[id]/page.tsx`, `src/app/(frontend)/uzytkownicy/[id]/raport/page.tsx`
- **See**: `docs/plans/2026-02-15-worker-reports-plan.md` for detailed implementation plan

### M18: Mobile Modal Overflow Fix ✅ DONE

- [x] Fixed horizontal overflow on mobile for transfer, settlement, and zero-saldo modals
- [x] Full-screen modals on mobile (sheet/drawer pattern), standard dialog on desktop
- [x] Form fields constrained to viewport width
- **Modified**: `src/components/ui/dialog.tsx`, modal components
- **Verified**: Tested at 320px–428px viewport widths

### M19: Invoices View & Download ✅ DONE

- [x] Dedicated page for browsing/searching uploaded invoices
- [x] Filtering by date, worker, investment
- [x] Download/preview functionality
- [x] Downloadable invoice PDF in every transfer table (cross-cutting)
- **Files**: `src/app/(frontend)/faktury/`, `src/components/transfers/transfer-data-table.tsx`

### M20: Add/Replace Invoice on Existing Transfers ✅ DONE

- [x] Edit transfer action — upload + attach invoice to existing transfer
- [x] Inline "Dodaj fakturę" button in transfer table rows
- [x] Permission: MANAGER own transfers, ADMIN/OWNER any
- [x] Revalidate transfer cache after update
- **Files**: `src/lib/actions/transfers.ts`, `src/components/transfers/`

---

### M21: Performance Audit & Optimization

> **Problem**: App feels slow everywhere — page navigations are the worst offender, mutations (e.g. adding a transfer) take ~3 seconds with a loader. Should feel instant.

#### Root Causes (from code analysis)

**A. Mutation overhead (transfer create = ~3 seconds)**

Each `payload.create('transactions')` triggers a synchronous hook chain that blocks the response:

1. `beforeValidate` — validation (fast, no DB)
2. `afterChange` in `recalculate-balances.ts`:
   - `sumRegisterBalance()` — 1 SQL SUM query
   - `payload.update('cash-registers')` — 1 DB write → triggers its own `afterChange` hook → `revalidateCollection('cashRegisters')`
   - `sumInvestmentCosts()` — 1 SQL SUM query (if investment-linked)
   - `payload.update('investments')` — 1 DB write → triggers its own `afterChange` hook → `revalidateCollection('investments')`
   - `revalidateCollections(['transfers', 'cashRegisters'])` ← 1st revalidation
3. `afterChange` in `revalidate-collection.ts`:
   - `revalidateCollection('transfers')` ← 2nd revalidation (DUPLICATE)
4. Back in `createTransferAction`:
   - `revalidateCollections(['transfers', 'cashRegisters'])` ← 3rd revalidation (DUPLICATE)

**Total**: 5-7 DB round trips + 3x duplicate cache invalidation, all synchronous.

**B. Cache invalidation is too broad (page navigations slow)**

Cache tags are **collection-level** only (`collection:transactions`, `collection:cash-registers`, etc.). Creating 1 transfer invalidates ALL `transactions`-tagged caches globally — every dashboard, every list page, every employee saldo, every investment detail. On next navigation, Next.js must re-run all those queries from scratch.

**C. Settlement is catastrophically slow**

Creates N transfers in a **sequential loop**, each with the full hook chain. 5 line items = ~30 DB operations + 6x cache invalidation, all sequential.

#### Implementation Plan

##### Phase 0: Dashboard Query Optimization ✅ DONE

**Branch:** `feat/dashboard-query-performance`

Eliminated `depth: 1` joins across all transfer and cash register queries. Dashboard cold-cache render: **2900ms → 884ms (-70%)**. Warm cache: **397ms**.

- [x] **Database indexes** — `idx_transactions_worker_type` on `(worker_id, type)`, `idx_transactions_date` on `(date)`. Migration: `20260216_add_performance_indexes.ts`
- [x] **Depth: 0 queries** — `findTransfersRaw`, `findAllTransfersRaw`, `findAllCashRegistersRaw` skip ORM relationship joins. Callers resolve names via lookup maps built from `fetchReferenceData`.
- [x] **Direct SQL count** — `countRecentTransfers` → `SELECT COUNT(*) FROM transactions WHERE date >= $1` (was `payload.find({ limit: 0 })`)
- [x] **UNION ALL reference data** — `fetchReferenceData` replaced 4 parallel Payload ORM queries with single `SELECT ... UNION ALL` across 4 tables
- [x] **Media batch-fetch** — `fetchMediaByIds(ids)` resolves invoice URLs from raw media IDs (depth: 0 returns IDs not objects)
- [x] **Lookup-based mapping** — `mapTransferRow(doc, lookups?)` resolves relationship IDs to names via `TransferLookupsT` maps. `buildTransferLookups(refData, mediaMap)` + `extractInvoiceIds(docs)` helpers.
- [x] **All callers migrated** — manager dashboard, employee dashboard, investment/cash-register/user detail pages, worker report page, employee-data.ts. Old depth:1 functions removed.
- **New files**: `src/lib/queries/media.ts`, `src/migrations/20260216_add_performance_indexes.ts`
- **Modified**: `src/lib/queries/transfers.ts`, `src/lib/queries/cash-registers.ts`, `src/lib/queries/reference-data.ts`, `src/lib/queries/employee-data.ts`, `src/lib/tables/transfers.tsx`, `src/components/dashboard/manager-dashboard.tsx`, `src/components/dashboard/employee-dashboard-server.tsx`, 4 detail pages
- **Results**:

| Query                     | Before | After   |
| ------------------------- | ------ | ------- |
| `findTransfersRaw`        | 2472ms | ~580ms  |
| `findAllCashRegistersRaw` | 1874ms | ~390ms  |
| `fetchReferenceData`      | 1572ms | ~580ms  |
| `countRecentTransfers`    | 1498ms | ~384ms  |
| `findAllUsersWithSaldos`  | 1438ms | ~490ms  |
| Detail page queries       | —      | 75-90ms |

##### Phase 1: Baseline measurement ✅ DONE

- [x] **Server action timing** — `perf()` / `perfStart()` wrappers (`src/lib/perf.ts`) around all server actions: `createTransferAction`, `createSettlementAction`, `zeroSaldoAction`. Measures total action time, Payload `create()`, media uploads.
- [x] **Hook timing** — `recalcAfterChange` and `recalcAfterDelete` instrumented with `performance.now()` + `perf()` for each SQL SUM and direct SQL UPDATE.
- [x] **Log format** — structured `[PERF] <operation> <duration>ms` logs with context (transfer type, line item count for settlements).

##### Phase 2: Quick wins (remove waste) ✅ DONE

- [x] **Remove duplicate revalidation** — actions no longer call `revalidateCollections`; hook handles it. Settlement uses `skipBalanceRecalc: true` + single revalidation at end.
- [x] **Remove cascading hook revalidation** — `recalculate-balances.ts` now uses direct SQL `UPDATE` instead of `payload.update()`, so cash-registers/investments `afterChange` hooks never fire during balance recalc. Generic hooks remain for direct admin edits and respect `context.skipRevalidation`.

##### Phase 3: Mutation speed (make creates feel instant) ✅ DONE

- [x] **Parallelize balance recalculation** — `Promise.all(tasks)` in `recalcAfterChange` runs `sumRegisterBalance` + `sumInvestmentCosts` + their SQL UPDATEs concurrently.
- [ ] **Investigate: fire-and-forget balance recalc** — explore `after()` from Next.js to run recalculation after response is sent. Deferred — current perf may be sufficient.
- [x] **Settlement: batch transfer creation** — `createSettlementAction` uses `Promise.all` for media uploads, `Promise.all` for transfer creates with `skipBalanceRecalc: true`, single SQL recalc at end.

##### Phase 4: Navigation speed (smarter caching)

- [ ] **Loading skeletons** — audit all pages for `loading.tsx` files. Any page without one feels frozen during data fetching. Add skeletons for dashboard, transfer list, worker detail, investment detail, cash register detail.
- [ ] **Granular cache tags** — replace collection-wide tags with entity-specific tags where it matters most:
  - `cashRegister:${id}:balance` — only invalidate the affected register
  - `investment:${id}:costs` — only invalidate the affected investment
  - `user:${id}:saldo` — only invalidate the affected worker's saldo
  - Keep `collection:transactions` for list queries but add per-entity tags for detail queries
- [ ] **Investigate: partial revalidation** — when creating a transfer for worker X on cash register Y, only invalidate caches that involve X or Y, not the entire transactions collection.
- [ ] **Optimistic updates** — update UI immediately on mutation (transfer create, settlement, zero-saldo) before server confirms. Close dialog + show new row/updated balance instantly, revalidate in background.
- [ ] **Mutation failure strategy** — define what happens when server rejects after optimistic update: toast with error details, revert optimistic state, offer retry. Consider: network errors vs validation errors vs hook failures (balance recalc). Needs a consistent pattern across all server actions.

##### Phase 5: Evaluate (Payload vs direct DB)

- [ ] **Compare Payload ORM vs direct Drizzle** — with instrumentation from Phase 1, measure `payload.find()` overhead vs raw SQL. If Payload's ORM adds >100ms per query, migrate hot-path reads to direct Drizzle (already available via `getDb()`).
- [ ] **Decision gate**: if Phases 1-3 bring mutation time to <500ms and navigation feels instant with cache hits, keep Payload. If not, plan migration to Prisma/Drizzle for the data layer.

- **Key files**: `src/hooks/transfers/recalculate-balances.ts`, `src/hooks/revalidate-collection.ts`, `src/lib/actions/transfers.ts`, `src/lib/actions/settlements.ts`, `src/lib/cache/tags.ts`, `src/lib/cache/revalidate.ts`, all `src/lib/queries/*.ts`, `loading.tsx` files
- **Success**: Transfer create <500ms, page navigation feels instant on cache hits, settlement proportional but parallelized

### Data Integrity: Balance Verification & Repair

> **Bug**: Cash register balances can become stale (non-zero with zero transfers). Root cause: `afterDelete` hook may not fire on bulk deletes via Payload admin, or hook errors swallow silently. Investment `totalCosts` likely has the same issue.

- [x] **Recalculate all balances script** — `recalculateBalancesAction()` in `src/lib/actions/transfers.ts`: ADMIN-only server action that re-runs `SUM()` for every cash register and investment, compares with stored values, updates mismatches, and reports what was fixed.
- [ ] **Investigate bulk delete** — confirm whether Payload's admin bulk delete triggers `afterDelete` per-doc or skips hooks. If it skips, add a `beforeBulkOperation` hook or disable bulk delete for transfers.
- [x] **On-demand verification** — `SyncBalancesButton` on manager dashboard (ADMIN only). Calls `recalculateBalancesAction()`, toasts result, refreshes page.

### M21.1: Remove `/transakcje` Page (Merge into Dashboard) ✅ DONE

> Dashboard and `/transakcje` render the same `TransferDataTable` with the same filters. Eliminating the duplicate page removes redundant queries on navigation and simplifies the sidebar.

- [x] **EMPLOYEE transfers on dashboard** — employee dashboard shows monthly transfers filtered by `worker=self`
- [x] **Move investment filter to dashboard** — investment filter added to dashboard's `TransferDataTable` and `TransferFilters`
- [x] **Remove `/transakcje` route** — deleted `src/app/(frontend)/transakcje/` directory
- [x] **Remove sidebar item** — "Transakcje" removed from sidebar nav
- [x] **Update internal links** — no `href="/transakcje"` references remain
- **Key files**: `src/app/(frontend)/transakcje/`, `src/components/layouts/sidebar/sidebar-nav.tsx`, `src/components/dashboard/manager-dashboard.tsx`, `src/components/dashboard/employee-dashboard-server.tsx`
- **Success**: One fewer page, one fewer set of queries, sidebar is simpler, all transfer browsing happens on dashboard

---

### M22: Bug Fixes & Form Polish

- [x] **Debug Juri saldo bug** — `sumEmployeeSaldo` correctly includes `ACCOUNT_FUNDING` in SQL `IN` clause. `recalcAfterChange` handles all 9 types including targetRegister. Fixed.
- [x] **Form reset after successful submit** — dialog close unmounts form component → TanStack Form state destroyed. No explicit `reset()` needed. All 3 forms (transfer, settlement, zero-saldo) clean up via dialog unmount.
- [x] **Investment column in transfer tables** — added `investment` column to `src/lib/tables/transfers.tsx` (all contexts: dashboard, cash register detail, worker detail, investment detail)
- [x] **Investment filter on transfer list page** — investment filter added to `TransferFilters` component, wired through dashboard and detail pages via URL params
- [x] **Remove invoiceNote requirement from settlement action** — removed runtime validation (lines 42-52) that required either a file per line item OR `invoiceNote`. Settlements can now be created without invoice documentation. Proper handling deferred to M27.
- **Key files**: `src/lib/actions/settlements.ts`
- **Success**: Saldo always consistent after any transfer type, all forms reset cleanly

### M23: Naming Overhaul ✅ DONE

Renamed terminology across the entire codebase to match business language.

#### Rename "Zaliczka" → "Zasilenie konta współpracownika"

- [x] **DB migration** — `ALTER TYPE enum_transactions_type RENAME VALUE 'ADVANCE' TO 'ACCOUNT_FUNDING'`
- [x] **Payload collection** — updated `TRANSFER_TYPES` option value + labels (pl: "Zasilenie konta współpracownika", en: "Account Funding")
- [x] **Constants** — updated `src/lib/constants/transfers.ts`: type enum, labels map, `needsWorker()` helper
- [x] **SQL queries** — updated all raw SQL in `src/lib/db/sum-transfers.ts` (`'ADVANCE'` → `'ACCOUNT_FUNDING'`)
- [x] **Validation hook** — updated `src/hooks/transfers/validate.ts` type checks
- [x] **Balance hook** — no references to `ADVANCE` in `recalculate-balances.ts` (already clean)
- [x] **Frontend forms** — updated transfer form, settlement form, zero-saldo dialog
- [x] **Schemas** — updated Zod schemas in `src/lib/schemas/transfers.ts`
- [x] **Stat card labels** — "Zaliczki w okresie" → "Zasilenia w okresie", "Zaliczki" → "Zasilenia", "zaliczki - wydatki" → "zasilenia - wydatki"
- [x] **Seed scripts** — updated `seed-transfers.ts` and `seed-ziutek-advances.ts`

#### Rename "Transakcje" → "Transfery"

- [x] **Sidebar** — already removed (M21.1), "Nowa transakcja" button → "Nowy transfer"
- [x] **Page titles** — `/transakcje` route already deleted (M21.1). Section headers on detail pages updated.
- [x] **Payload admin labels** — collection labels: pl "Transfer"/"Transfery", en "Transfer"/"Transfers"
- [x] **UI text** — dialog titles, descriptions, toast messages, empty states, stat cards, form labels, placeholders
- [x] **Validation messages** — "tego typu transakcji" → "tego typu transferu" in Zod schemas (in `src/lib/schemas/transfers.ts`)
- [x] **URL route** — N/A, `/transakcje` was already deleted in M21.1

- **Migration**: `20260218_rename_advance_to_account_funding.ts`
- **Modified**: `src/collections/transfers.ts`, `src/collections/investments.ts`, `src/collections/cash-registers.ts`, `src/lib/constants/transfers.ts`, `src/lib/db/sum-transfers.ts`, `src/hooks/transfers/validate.ts`, `src/lib/schemas/transfers.ts`, `src/lib/actions/settlements.ts`, `src/components/dialogs/add-transfer-dialog.tsx`, `src/components/dialogs/add-settlement-dialog.tsx`, `src/components/dialogs/zero-saldo-dialog.tsx`, `src/components/transfers/transfer-form.tsx`, `src/components/transfers/transfer-data-table.tsx`, `src/components/dashboard/manager-dashboard.tsx`, `src/components/dashboard/employee-dashboard-server.tsx`, `src/components/settlements/settlement-form.tsx`, detail pages (inwestycje, kasa, uzytkownicy, raport)
- **Verified**: `pnpm typecheck` (0 errors), no stale `ADVANCE`/`Transakcj`/`Zaliczk` references in production source

### M23.1: Code-Level Rename (transaction → transfer) ✅ DONE

M23 renamed UI text; this milestone renames all remaining code identifiers — file paths, type names, constants, functions, imports. The Payload collection slug and DB table stay as `transactions`.

- [x] **13 files renamed** via `git mv`: collections, hooks, constants, schemas, actions, queries, tables, db, components, scripts
- [x] **~85 identifiers renamed**: `TRANSACTION_*` → `TRANSFER_*`, `Transaction*` → `Transfer*`, `transaction*` → `transfer*` across ~30 consumer files
- [x] **Cache tag key** renamed: `CACHE_TAGS.transactions` → `CACHE_TAGS.transfers` (value `'collection:transactions'` unchanged)
- [x] **`revalidateCollections`** calls updated to use new key `'transfers'`
- [x] **`storageKey`** updated from `"transactions"` to `"transfers"`
- [x] **`package.json`** script: `seed:transactions` → `seed:transfers`
- **Preserved**: collection slug `'transactions'`, SQL table name, migration files, `payload-types.ts`
- **Verified**: `pnpm generate:types` + `pnpm typecheck` (0 errors) + `pnpm lint` (0 errors)

### M24: Transfer Type System Overhaul ✅ DONE

> **Resolved design decisions:**
>
> - **Q1 (Investment saldo):** Deferred — keep `totalCosts` as positive accumulator for now. Revisit if/when investor payments are implemented.
> - **Q2 (Employee expense + register):** `EMPLOYEE_EXPENSE` has **no cash register field at all**. Clean separation: advances go through registers, employee expenses go through worker accounts only.
> - **Q3 (Register transfers):** Implement as a single `REGISTER_TRANSFER` transfer with `sourceRegister` (= `cashRegister`) + `targetRegister` field.
> - **Q4 (Deposit subtypes):** Separate top-level transfer types (not a subtype field).

#### Type Matrix

| Type                 | Polish label                    | Required fields                    | Register effect                     |
| -------------------- | ------------------------------- | ---------------------------------- | ----------------------------------- |
| `INVESTOR_DEPOSIT`   | Wpłata od inwestora             | cashRegister, investment           | +amount                             |
| `STAGE_SETTLEMENT`   | Rozliczenie etapu               | cashRegister, investment           | +amount                             |
| `COMPANY_FUNDING`    | Zasilenie z konta firmowego     | cashRegister                       | +amount                             |
| `OTHER_DEPOSIT`      | Inna wpłata                     | cashRegister                       | +amount                             |
| `INVESTMENT_EXPENSE` | Wydatek inwestycyjny            | cashRegister, investment           | -amount                             |
| `ACCOUNT_FUNDING`    | Zasilenie konta współpracownika | cashRegister, worker               | -amount                             |
| `EMPLOYEE_EXPENSE`   | Wydatek pracowniczy             | worker; investment optional        | **none**                            |
| `REGISTER_TRANSFER`  | Transfer między kasami          | cashRegister (src), targetRegister | -amount from src, +amount to target |
| `OTHER`              | Inne                            | cashRegister, otherCategory        | -amount                             |

#### Step 1: Constants (`src/lib/constants/transfers.ts`) ✅

- [x] 9 transfer types with Polish labels, `DEPOSIT_TYPES` array
- [x] All helpers: `isDepositType`, `needsCashRegister`, `showsInvestment`, `requiresInvestment`, `needsWorker`, `needsTargetRegister`, `needsOtherCategory`

#### Step 2: DB Migration ✅

- [x] `20260218_0_transaction_type_enums.ts` — 5 new enum values
- [x] `20260218_transaction_type_overhaul.ts` — `target_register_id` column + FK, DEPOSIT→OTHER_DEPOSIT migration, EMPLOYEE_EXPENSE cashRegister nulled, NOT NULL dropped
- [x] `20260218_rename_advance_to_account_funding.ts` — ADVANCE→ACCOUNT_FUNDING enum rename

#### Step 3: Collection Config (`src/collections/transfers.ts`) ✅

- [x] 9 type options, `targetRegister` field with conditional visibility, `cashRegister` optional

#### Step 4: Validation Hook (`src/hooks/transfers/validate.ts`) ✅

- [x] All 9 types validated, REGISTER_TRANSFER source≠target check, auto-clear inapplicable fields

#### Step 5: SQL Queries (`src/lib/db/sum-transfers.ts`) ✅

- [x] `sumRegisterBalance` rewritten with deposit type CASE + REGISTER_TRANSFER target subquery
- [x] `sumInvestmentCosts`, `sumEmployeeSaldo`, `sumAllWorkerSaldos`, `sumWorkerPeriodBreakdown` — unchanged, correct

#### Step 6: Balance Hooks (`src/hooks/transfers/recalculate-balances.ts`) ✅

- [x] `recalcAfterChange` + `recalcAfterDelete` handle `targetRegisterId` in parallel with source register

#### Step 7: Schemas (`src/lib/schemas/transfers.ts`) ✅

- [x] Both server + client schemas have `targetRegister`, REGISTER_TRANSFER validation, optional `cashRegister`

#### Step 8: Transfer Action (`src/lib/actions/transfers.ts`) ✅

- [x] DEPOSIT-specific default description removed

#### Step 9: Table Mapping (`src/lib/tables/transfers.tsx`) ✅

- [x] `targetRegisterName` on `TransferRowT`, column definition, mapper resolves via lookups

#### Step 10: Transfer Form (`src/components/forms/transfer-form/transfer-form.tsx`) ✅

- [x] `targetRegister` field conditional on `needsTargetRegister`, `cashRegister` conditional on `needsCashRegister`, investment on `showsInvestment`

#### Step 11: Settlement + Zero-Saldo ✅

- [x] `cashRegister` removed from all settlement schemas, actions, forms, and dialog props

#### Step 12: Regenerate & Verify ✅

- [x] `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm payload migrate` — all clean

#### Key Risks

1. **Existing DEPOSIT rows** → migrated to OTHER_DEPOSIT. DEPOSIT stays in PG enum (unused). No new DEPOSIT rows can be created since it's not in the UI options (transfer form excludes it).
2. **EMPLOYEE_EXPENSE losing cashRegister** → behavioral change. Settlements no longer debit a register. This is correct (the advance already debited it), but users may notice.
3. **sumRegisterBalance SQL** → most complex change. The UNION subquery for target register transfers must be correct to avoid balance drift.

#### Files Changed (20 files)

| File                                                   | Change                                                    |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `src/lib/constants/transfers.ts`                       | 9 types, labels, helpers                                  |
| `src/migrations/20260218_transaction_type_overhaul.ts` | NEW — enum + column + data migration                      |
| `src/migrations/index.ts`                              | Register migration                                        |
| `src/collections/transfers.ts`                         | Type options, targetRegister field, cashRegister optional |
| `src/hooks/transfers/validate.ts`                      | New validation matrix                                     |
| `src/lib/db/sum-transfers.ts`                          | sumRegisterBalance rewrite                                |
| `src/hooks/transfers/recalculate-balances.ts`          | targetRegister handling                                   |
| `src/lib/schemas/transfers.ts`                         | targetRegister, cashRegister optional                     |
| `src/lib/actions/transfers.ts`                         | Remove DEPOSIT description fallback                       |
| `src/lib/tables/transfers.tsx`                         | targetRegisterName column + mapping                       |
| `src/components/forms/transfer-form/transfer-form.tsx` | targetRegister, conditional cashRegister                  |
| `src/lib/schemas/settlements.ts`                       | Remove cashRegister                                       |
| `src/lib/actions/settlements.ts`                       | Remove cashRegister + register recalc                     |
| `src/components/settlements/settlement-form.tsx`       | Remove cashRegister field                                 |
| `src/components/dialogs/zero-saldo-dialog.tsx`         | Remove cashRegister                                       |
| `src/components/dialogs/add-settlement-dialog.tsx`     | Remove managerCashRegisterId                              |
| `src/app/(frontend)/uzytkownicy/[id]/page.tsx`         | Update ZeroSaldoDialog props                              |
| `src/payload-types.ts`                                 | Auto-regenerated                                          |
| `src/scripts/seed-transfers.ts`                        | Update type values (optional)                             |

#### Verification

1. `pnpm typecheck` — 0 errors
2. `pnpm payload migrate` — migration runs cleanly
3. Manual: create one of each new type via the form, verify register balances update correctly
4. Manual: create a REGISTER_TRANSFER, verify source register debited and target credited
5. Manual: create EMPLOYEE_EXPENSE without selecting a cash register, verify no register balance change
6. Manual: verify settlement form no longer shows cash register field

- **Migration**: `20260218_transaction_type_overhaul.ts` — new enum values, `target_register_id` column, data migration for existing rows
- **Key files**: `src/collections/transfers.ts`, `src/hooks/transfers/validate.ts`, `src/hooks/transfers/recalculate-balances.ts`, `src/lib/db/sum-transfers.ts`, `src/lib/constants/transfers.ts`, `src/lib/schemas/transfers.ts`, `src/components/forms/transfer-form/transfer-form.tsx`, `src/lib/queries/transfers.ts`
- **Depends on**: M23 (naming — `ADVANCE` already renamed to `ACCOUNT_FUNDING`) ✅
- **Success**: All new types work end-to-end, register balances correct, no double-charging on employee expenses

### M25: Cash Flow Integrity & Lockdown

- [ ] **Restrict balance editing in Payload admin** — remove manual balance override for ALL roles. Balance field becomes truly computed-only (remove `update` access, keep `admin.readOnly: true`).
- [ ] **Consider disabling transfer editing** — evaluate if editing existing transfers should be blocked (safer for accounting). Only corrections via new offsetting transfers.
- [ ] **Verify cash flow integrity** — write a verification script/action that checks: `SUM(all deposits) - SUM(all withdrawals) = SUM(all register balances)`. Run against existing data.
- [ ] **Fix any existing data inconsistencies** — if M24 migration reveals balance discrepancies from the double-charge bug, recalculate all register balances.
- **Depends on**: M24

### M26: Cash Register Permissions ✅ DONE

- [x] **Add `type` field to CashRegisters** — `MAIN` | `AUXILIARY` (select field, default `AUXILIARY`)
- [x] **DB migration** — `20260218_add_cash_register_type.ts`: enum + column + "Kasa główna" set to MAIN
- [x] **Collection config** — `type` field with admin condition (ADMIN/OWNER only), `read` access opened to MANAGER, `delete` blocked for all roles
- [x] **Reference data** — `fetchReferenceData()` SQL returns `type`, `CashRegisterRefItemT` type added
- [x] **Cash register rows** — `CashRegisterRowT` and `mapCashRegisterRows` include `type`
- [x] **Dashboard** — MANAGER sees only AUXILIARY register balances and tables. SyncBalancesButton visible to OWNER too.
- [x] **Forms** — Navigation filters MAIN registers from reference data before passing to TopNav/forms. MANAGER never sees MAIN in dropdowns.
- [x] **Detail page guard** — `/kasa/[id]` returns 404 for MANAGER accessing MAIN register
- **Key files**: `src/collections/cash-registers.ts`, `src/lib/queries/reference-data.ts`, `src/lib/queries/cash-registers.ts`, `src/lib/tables/cash-registers.tsx`, `src/components/dashboard/manager-dashboard.tsx`, `src/components/nav/navigation.tsx`, `src/components/dialogs/add-transfer-dialog.tsx`, `src/app/(frontend)/kasa/[id]/page.tsx`
- **Migration**: `20260218_add_cash_register_type.ts`
- **Verified**: `pnpm typecheck` (0 new errors), `pnpm lint` (0 errors)
- **Success**: MANAGER cannot see or select MAIN registers anywhere, OWNER sees everything, no register can be deleted

### M27: Settlement Relaxation

- [ ] **Make `investment` optional** — remove required validation on `investment` field in settlement form and `createSettlementAction`
- [ ] **Allow adding investment later** — extend existing M20 edit action to support adding/changing `investment` on existing transfers
- [ ] **Expense subtype in settlement** — evaluate adding a type selector to settlement line items (e.g., "Materiały", "Robocizna", "Inne")
- **Key files**: `src/hooks/transfers/validate.ts`, `src/lib/schemas/settlements.ts`, `src/components/settlements/settlement-form.tsx`, `src/lib/actions/settlements.ts`, `src/lib/actions/transfers.ts`
- **Success**: Settlement submittable without investment or invoice, both can be attached later

### M28: Investment View Enhancements ✅ DONE

- [x] **`totalIncome` field** — computed via hooks, SUM of `INVESTOR_DEPOSIT` + `STAGE_SETTLEMENT` per investment
- [x] **`laborCosts` field** — manually entered by OWNER/ADMIN on Investments collection
- [x] **`sumInvestmentIncome()` SQL** — new aggregation function mirroring `sumInvestmentCosts`
- [x] **Hook update** — `recalcInvestmentFinancials` calculates both costs + income in parallel, single UPDATE
- [x] **Settlement action** — recalculates both `totalCosts` and `totalIncome`
- [x] **Investment detail page** — OWNER/ADMIN sees 4 stat cards (Koszty inwestycji, Wpłaty od inwestora, Koszty robocizny, Bilans). MANAGER sees transfer history only.
- [x] **Transfer type filter** — already working via `TransferFilters` with `showTypeFilter=true` default
- **Migration**: `20260218_add_investment_financials.ts`
- **Key files**: `src/collections/investments.ts`, `src/lib/db/sum-transfers.ts`, `src/hooks/transfers/recalculate-balances.ts`, `src/lib/actions/settlements.ts`, `src/app/(frontend)/inwestycje/[id]/page.tsx`
- **Verified**: `pnpm typecheck` (0 new errors), `pnpm lint` (0 errors)

---

## Milestone Dependency Graph

```
M21 (Perf) ─── Phase 0-3 ✅, Phase 4-5 open
  │
  ├── M22 (Bugs/Polish) ─── 3 items remaining (saldo bug, form reset, invoiceNote)
  │
  ├── M23 (Naming) ─── ✅ DONE
  │     │
  │     └── M24 (Type System) ─── ✅ DONE
  │           │
  │           ├── M25 (Cash Flow) ─── UNBLOCKED, ready to start
  │           │
  │           ├── M27 (Settlement) ─── UNBLOCKED, ready to start
  │           │
  │           └── M28 (Investment View) ─── blocked by M25
  │
  └── M26 (Register Permissions) ─── independent, ready to start
```

---

## Local Dev Setup

```bash
docker compose up -d      # start Postgres 17
pnpm dev                  # start Next.js 16 + Payload 3.73 (Turbopack)
```

- Frontend: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- Postgres: localhost:5432 (user: postgres, pass: postgres, db: wykonczymy)

### Useful commands

```bash
pnpm payload migrate          # run pending migrations
pnpm migrate:create           # create a new migration
pnpm generate:types           # regenerate payload-types.ts
pnpm generate:importmap       # regenerate admin importMap.js
```

---

## What's Left

### Ready to start

| Milestone                          | Scope                                                                                         | Size |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | ---- |
| ~~**M25: Cash Flow Integrity**~~   | ~~Lock balance fields, disable transfer editing, verify SUM = balances, fix inconsistencies~~ | ✅   |
| ~~**M26: Register Permissions**~~  | ~~`MAIN`/`AUXILIARY` register types, role-based visibility in forms + dashboard~~             | ✅   |
| ~~**M27: Settlement Relaxation**~~ | ~~Make `investment` optional, per-item categories from `other-categories`~~                   | ✅   |

### Remaining items in done milestones

| Milestone          | Item                                    | Notes                                                                                                 |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **M21 Phase 4**    | ~~Stream transfer table with Suspense~~ | ✅ Done — `TransferTableServer` async component + `<Suspense>` in 5 pages                             |
| **M21 Phase 4**    | ~~Granular cache tags~~                 | ✅ Done — `entityTag()` helper, entity tags on detail queries, fixed investments revalidation bug     |
| **M22**            | ~~invoiceNote settlement check~~        | ✅ Removed — deferred to M27                                                                          |
| **Data Integrity** | Bulk delete investigation               | Does Payload admin bulk delete fire `afterDelete` per doc?                                            |
| **Data Integrity** | ~~Periodic balance verification~~       | ✅ Done — `SyncBalancesButton` on manager dashboard (ADMIN only), calls `recalculateBalancesAction()` |

### M29: Test Coverage — Form Validation & Business Logic

> **Motivation**: Validation mismatches between client schema, server schema, and Payload hooks have caused silent failures. Examples:
>
> - EMPLOYEE_EXPENSE without investment passes client validation but server hook rejects it
> - Settlement server schema (`createSettlementSchema`) is a flat `z.object` with no `superRefine` — doesn't enforce `investment` when mode=investment or `category`/`note` per line item when mode=category (only client schema does)
> - Stale form values persist when switching transfer type (hidden fields keep old values)
>
> Tests are needed to catch these gaps, verify client/server parity, and prevent regressions.

#### Phase 1: Test Framework Setup

- [ ] **Install Vitest** — `pnpm add -D vitest` + `vitest.config.ts` with path aliases matching `tsconfig.json`
- [ ] **Test scripts** — Add `"test"`, `"test:watch"`, `"test:coverage"` to `package.json`
- [ ] **Test directory structure** — `src/__tests__/` with files mirroring source tree

#### Phase 2: Transfer Form — Schemas & Helpers

##### 2a: Transfer Constants (`src/lib/constants/transfers.ts`)

- [ ] **Helper truth table** — For each of the 9 transfer types, assert expected return value of every helper:
  - `isDepositType` — true for 4 deposit types, false for 5 others
  - `needsCashRegister` — false only for EMPLOYEE_EXPENSE
  - `showsInvestment` — true for INVESTOR_DEPOSIT, STAGE_SETTLEMENT, INVESTMENT_EXPENSE, EMPLOYEE_EXPENSE
  - `requiresInvestment` — true for INVESTOR_DEPOSIT, STAGE_SETTLEMENT, INVESTMENT_EXPENSE only
  - `needsWorker` — true for ACCOUNT_FUNDING, EMPLOYEE_EXPENSE only
  - `needsTargetRegister` — true for REGISTER_TRANSFER only
  - `needsOtherCategory` — true for OTHER only
- [ ] **Edge cases** — empty string, unknown type string → verify all helpers return false

##### 2b: Server Schema (`createTransferSchema`)

- [ ] **Valid payloads** — One valid payload per transfer type, each `.safeParse()` should succeed:
  - INVESTOR_DEPOSIT: amount, date, type, paymentMethod, cashRegister, investment
  - STAGE_SETTLEMENT: same as above
  - COMPANY_FUNDING: amount, date, type, paymentMethod, cashRegister
  - OTHER_DEPOSIT: same as COMPANY_FUNDING
  - INVESTMENT_EXPENSE: cashRegister + investment
  - ACCOUNT_FUNDING: cashRegister + worker
  - EMPLOYEE_EXPENSE: worker + investment (no cashRegister)
  - REGISTER_TRANSFER: cashRegister + targetRegister (different IDs)
  - OTHER: cashRegister + otherCategory
- [ ] **Missing required fields** — For each type, omit each conditionally required field and verify `.safeParse()` fails with the correct error path:
  - INVESTOR_DEPOSIT without cashRegister → error on `cashRegister`
  - INVESTOR_DEPOSIT without investment → error on `investment`
  - ACCOUNT_FUNDING without worker → error on `worker`
  - REGISTER_TRANSFER without targetRegister → error on `targetRegister`
  - REGISTER_TRANSFER with targetRegister === cashRegister → error on `targetRegister`
  - OTHER without otherCategory → error on `otherCategory`
  - EMPLOYEE_EXPENSE without worker → error on `worker`
- [ ] **Amount edge cases** — 0, negative, NaN → all should fail
- [ ] **EMPLOYEE_EXPENSE special cases** (validated by hook, NOT by schema — document this):
  - investment only → passes schema (hook will also pass)
  - otherCategory only → passes schema (hook will also pass)
  - neither investment nor otherCategory → passes schema (but hook rejects — this is the gap)

##### 2c: Client Schema (`transferFormSchema`)

- [ ] **Mirror of 2b but with string values** — same test matrix, values as strings (`"100"` not `100`)
- [ ] **Empty string vs missing** — verify `""` for optional fields is handled correctly

##### 2d: Schema Parity Tests

- [ ] **For each of the 9 types**: generate a valid server payload + equivalent string-based client payload. Verify both schemas agree (both pass or both fail).
- [ ] **Known mismatch (EMPLOYEE_EXPENSE)**: document that client passes without investment while server schema also passes, but Payload hook rejects. This test should FAIL until Phase 5 fix is applied — use `test.fails()` or `TODO` marker.

#### Phase 3: Settlement Form — Schemas

##### 3a: Client Schema (`settlementFormSchema`)

- [ ] **Investment mode — valid** — worker + investment + date + paymentMethod + 1 line item (description + amount > 0) → passes
- [ ] **Investment mode — missing investment** → error on `investment`
- [ ] **Investment mode — missing worker** → error on `worker`
- [ ] **Investment mode — empty line items** → error on `lineItems`
- [ ] **Investment mode — line item without description** → error on `lineItems[0].description`
- [ ] **Investment mode — line item with amount=0** → error on `lineItems[0].amount`
- [ ] **Investment mode — line item with negative amount** → error on `lineItems[0].amount`
- [ ] **Category mode — valid** — worker + date + paymentMethod + 1 line item (description + amount + category + note) → passes
- [ ] **Category mode — missing category per line item** → error on `lineItems[0].category`
- [ ] **Category mode — missing note per line item** → error on `lineItems[0].note`
- [ ] **Category mode — investment NOT required** (it's hidden in UI)
- [ ] **Multiple line items** — 3 items, one invalid → only the invalid one gets errors
- [ ] **Date missing** → error on `date`

##### 3b: Server Schema (`createSettlementSchema`)

- [ ] **Valid payloads** — same as 3a but with typed values (numbers for IDs/amounts)
- [ ] **Known gaps** (should FAIL until fix is applied):
  - mode=investment without investment → passes server schema (no `superRefine`) but should fail
  - mode=category without category per line item → passes server schema but should fail
  - mode=category without note per line item → passes server schema but should fail
- [ ] **Basic validation** — worker not positive, empty date, empty lineItems array → should fail

##### 3c: Schema Parity (Settlement)

- [ ] **Investment mode**: valid client payload + equivalent server payload → both pass
- [ ] **Category mode**: valid client payload + equivalent server payload → both pass
- [ ] **Known mismatches**: mode=investment without investment passes server but fails client. Document with `test.fails()`.

##### 3d: Zero-Saldo Schemas

- [ ] **Client (`zeroSaldoFormSchema`)** — investment required (string), missing investment → error
- [ ] **Server (`zeroSaldoSchema`)** — worker + investment + paymentMethod + amount all required and positive
- [ ] **Parity** — valid payloads agree, missing fields agree

#### Phase 4: Validate Hook (`validateTransfer`)

- [ ] **All 9 types with valid data** — returns data without throwing
- [ ] **Missing required fields per type** — throws Error with correct message
- [ ] **Auto-clear behavior**:
  - EMPLOYEE_EXPENSE → `cashRegister` set to `null`
  - EMPLOYEE_EXPENSE with both investment + otherCategory → otherCategory + otherDescription set to `null`
- [ ] **EMPLOYEE_EXPENSE special**:
  - investment only → passes
  - otherCategory only → passes
  - neither → throws "requires either an investment or a category"
  - both → passes, otherCategory auto-cleared
- [ ] **REGISTER_TRANSFER** — targetRegister === cashRegister → throws
- [ ] **`createdBy` auto-set** — on operation=create with req.user, data.createdBy is set

#### Phase 5: Fix Known Validation Gaps

- [ ] **Transfer form — EMPLOYEE_EXPENSE client validation**:
  - Add "investment OR otherCategory required" to `transferFormSchema` superRefine
  - Decide: show `otherCategory` in form for EMPLOYEE_EXPENSE (match server flexibility) OR require investment client-side
- [ ] **Settlement server schema — add `superRefine`** to `createSettlementSchema`:
  - mode=investment → investment required
  - mode=category → each line item needs category (and optionally note)
- [ ] **Transfer form — reset conditional fields on type change**:
  - When type changes, clear fields that become hidden (cashRegister, targetRegister, investment, worker, otherCategory, otherDescription)
  - Use TanStack Form's `listeners.onChange` on the `type` field to reset dependent values
- [ ] **Re-run all parity tests** — previously failing tests should now pass

- **New deps**: `vitest` (dev)
- **New files**: `vitest.config.ts`, `src/__tests__/transfer-constants.test.ts`, `src/__tests__/transfer-schema.test.ts`, `src/__tests__/settlement-schema.test.ts`, `src/__tests__/validate-hook.test.ts`
- **Key files under test**: `src/lib/constants/transfers.ts`, `src/components/forms/transfer-form/transfer-schema.ts`, `src/components/forms/settlement-form/settlement-schema.ts`, `src/hooks/transfers/validate.ts`
- **Success**: All validation schemas tested with full type/mode matrix, client/server parity verified for both forms, known validation gaps fixed, zero-saldo schemas covered

---

### End-of-project

| Item                          | Notes                                                     |
| ----------------------------- | --------------------------------------------------------- |
| **Payload vs Drizzle eval**   | Measure ORM overhead, decide on migration (M21 Phase 5)   |
| **Optimistic updates**        | Instant UI feedback on mutations, background revalidation |
| **Mutation failure strategy** | Revert optimistic state, toast error, retry pattern       |
