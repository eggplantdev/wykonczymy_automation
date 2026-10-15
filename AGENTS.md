# AGENTS.md

Only what's true for THIS repo and not inferable from the framework or `@package.json`. Global conventions (style, TS/React/Next/Tailwind, git, personas) live in the user's global rules.

## Project Overview

Business management dashboard for cash registers, transfers, investments and employees. Next.js +
Payload CMS. **Polish UI, English code.**

**Scale: ~40 accounts and growing (2026-10-07)** — a handful of management accounts plus every worker
(EMPLOYEE), who report work and hours from their phones on site (EX-947, EX-985). Size risk to dozens
of concurrent phone users, not to "five users" and not to enterprise traffic.

## Hard Stops

- **Prod DB (Neon, `DB_POSTGRES_URL_PROD`):** read-only queries are fine. Never run a migration, DDL or
  dump-restore against it — schema and restores are human-only. A **data write** needs the user's
  explicit go for that write, whatever the tool: raw SQL, a Payload script on the prod URL and a server
  action on the live app write the same rows.
- **Prod migrations** are applied by a human with `pnpm db:migrate:prod`, never by the agent (see Migrations).
- **Google Sheets writes happen only from production.** Every non-prod DB carries live sheet ids; the gate
  is the credential (dev holds a Viewer-only account). Never give the reader account Editor. Detail:
  `context/reference/kosztorys-sync.md` → „Service accounts and sharing".
- **The production Vercel Blob store belongs to production only** — no versioning, no undelete, and
  the local DB's `media.filename` values are real invoices. `.env` points `BLOB_READ_WRITE_TOKEN` at
  the **preview** store; reaching prod means exporting `BLOB_READ_WRITE_TOKEN_PROD` at the call site.
  `.env.local` (written by `vercel env pull`) overrides `.env` — beware. Runbook:
  `context/reference/blob-recovery-runbook.md` §3.
- **Mail goes out only from production** — `EMAIL_HOST` is `disabled.invalid` outside it. Recipient lists
  live in the DB, so every `db:import` carries real addresses. Read
  `context/reference/outgoing-effects-isolation.md` before adding any new outgoing integration.

## Naming a financial figure

Consult the glossary `@context/domain/02-glossary.md` (EX-548) before naming a figure. In short:

1. Polish identifiers only for sheet proper nouns with no clean English equivalent (`kosztorys`,
   `przedmiar`, `pomiar`). `etapy` / `robocizna` are `stage` / `laborCosts` in code.
2. Generic figures are English: `balance` / `margin` / `discount` / `deposit` / `payout` / `loss`.
3. No half-translated identifiers (`robociznaNet`, `zaliczkiByStage`) — one identifier, one language.
4. One concept, one name across kosztorys and transfers. The only exception: where a concept exists on
   both planes and the reconciliation compares them, append `FromKosztorys` / `FromTransactions` to an
   identical base name. A one-plane figure stays bare.

## The Owner's Reference Sheet (read this before touching kosztorys)

The kosztorys editor is a port of a live Google Sheet, and **the sheet is the domain authority** — for
"what does this figure mean", read its formulas, not our code.

**Talk to the owner in one register per message.** Domain/design conversation uses the sheet's names
(„Przedmiar", „Pomiar z natury", „etapy", „Cena j.m.", „rabat", „Wartość netto przedmiar") — never
`plannedQty` / `measuredQty` / `rowValueForView`, not even as a parenthetical gloss. Code identifiers
only in code review, implementation notes and commits. Translating is the agent's job, silently.

Canonical sheet (the state a client receives as an initial offer), read with the inspector — it dumps
formulas and values side by side, and a formula is evidence where a rendered number is only a hint:

```bash
SHEET_ID=1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg TABS="kosztorys_robocizny" MAX_ROWS=464 \
  node --env-file=./.env scripts/inspect-sheet.mjs > /tmp/sheet.txt
```

Load-bearing facts (verified across all 435 item rows, 2026-07-16):

- `N` **Przedmiar** is typed by hand — the offered scope. `S` = `N × cena − rabat` = **the offer**.
- `O` **Pomiar z natury** is a formula, `=SUM(D:M)` over the ten stage columns — **pomiar IS the stage
  sum**, and `T` = `O × cena − rabat` is what has been executed (EX-494).
- The footer keeps `wartość netto` (`T456`) and `R netto - suma prac wykonannych` (`T463`) as separate
  rows — read them before assuming which figure a UI "total" should be.

Filled test sheet, offer-view screenshots and domain background:
`context/reference/kosztorys-editor-domain-notes.md`.

## Transfer Business Logic

The transfer-type union lives in `src/collections/transfers.ts` — read it there. How marża / bilans /
robocizna / korekty connect, and the v1/v2 source rules: `context/foundation/investment-financials-and-discount.md`.

- `LABOR_COST` (robocizna) — no source register; a billing figure feeding marża, not a cash movement.
- `CORRECTION` must be negative (`getAmountError`); moves only the balance.
- `RABAT` — no source register, positive, investment required. Lowers marża **and** raises bilans; grosses
  by VAT on the brutto plane.
- `LOSS` (strata) — no source register, positive, investment required (EX-675). Hits both figures like
  `RABAT` but deducts at face value on netto and brutto alike.
- `BONUS` (premia) — no source register, positive, investment **and** worker required (EX-979); only
  ADMIN/OWNER book it (`canBookTransferType`, since a MANAGER passes `protectedAction`). Raises that
  pair's „Pozostało do wypłaty", lowers marża **v2 only**, never reaches the investor or the sheet.
- Cancellation marks the original `cancelled: true` and links a new `CANCELLATION` row to it.
- `COMPANY_FUNDING` is gated to ADMIN/OWNER client-side only — an accepted owner ruling (EX-557). Don't re-raise it.
- Register balances are computed on read, never stored; transfer hooks only revalidate tags.
- `LABOR_COST` / `RABAT` are bookable again **temporarily** (EX-649; EX-712 removes them). No kosztorys
  means robocizna and rabat are 0 zł on v2 — no fallback to transfers; the gap with v1 is the to-do list,
  not a defect.

## Mutation Pattern

All mutations go through `protectedAction()` in `src/lib/actions` (`'use server'`, `requireAuth()`,
`perfStart()`, returns `ActionResultT`, revalidates). It admits management roles only; a mutation every
role may call uses `sessionAction`, and its handler must scope the write to `ctx.user` — never take whose
data it is as an argument. Forms use TanStack Form via `useAppForm()`; optimistic updates go through
`useOptimisticFormStore` (Zustand), fire-and-forget.

## Data Fetching And Cache

- Financial calculations use raw SQL through Payload's Drizzle instance (`getDb`), not the Payload ORM.
- Cache via `unstable_cache`, always through `cached()` (`lib/cache/cached.ts`), which keys on the
  deployment (EX-1063) — no `-vN` key bumps. A `RUN-AFTER-DEPLOY` data migration still needs a Vercel
  Data Cache purge right after it runs. `cacheComponents` / `'use cache'` are off (Vercel bug).
- **Server actions** expire with `updateTag()`; **Payload hooks, Route Handlers and crons** with
  `revalidateTag()` (`updateTag` throws there). Never import `lib/cache/revalidate.ts` from a Payload hook.
- **`revalidateTag` always takes `EXPIRE_NOW`** (`lib/cache/tags.ts`) as its second argument — a named
  profile serves the stale value once. Sole exception: `revalidateCollections(…, { deferRefresh: true })`
  passes `EXPIRE_NEXT`, because `expire: 0` in a Server Action also re-renders the calling route (EX-597).
- **A cache entry that changes for ONE row is tagged with `entityTag`**, expired via `protectedAction`'s
  `opts.entityTags` — a collection slug is bumped by every write to that collection anywhere (EX-849).
  Keep a slug only where some writer genuinely can't name the row. **Count every writer** of the row
  when adding an entity tag; one missed writer is a permanently stale read.

## Auth And Roles

JWT via Payload's `payload-token` cookie (90 days, slid forward at most daily by `SessionRefresher`).
Roles `ADMIN`, `OWNER`, `MANAGER`, `EMPLOYEE`; hierarchy in `src/lib/auth/roles.ts`, access functions in
`src/access`.

- **Session check (EX-918, temporary per EX-1020):** `getCurrentUserJwt` checks the token's `sid` and the
  account's `active` / `trashed_at` / `role`, cached per `sid` under the `users` tag — every write to
  `users` expires it. Payload's logout runs no hook, so `logoutAction` expires it by hand; a raw-SQL
  write to `users` waits for the 1 h backstop.
- Nobody deactivates, trashes or deletes their own account or the last live OWNER/ADMIN; a MANAGER acts
  only on EMPLOYEE accounts (`canManageAccount`).
- **An EMPLOYEE may read only his own `/pracownicy/[id]`** (`canViewWorkerPage`, EX-985), transfers
  scoped server-side; `/kasa/[id]` is management-only.
- **Own e-mail/password goes through `changeOwnCredentialsAction`** (EX-989, every role, current password
  checked by `payload.login`). REST update on `users` is closed to EMPLOYEE entirely; `unlock` is
  management-only.
- **Every „Usuń na zawsze" in `/kosz` requires the typed name, checked server-side for every kind** — no
  per-kind exception.
- Accepted account behaviour (lockout, credentials, language): `context/reference/accounts-and-access.md`.

## Architecture

### Routes

- **Parallel-route slots:** shell chrome that needs route params gets a `@slot` under `(frontend)/`
  whose `page.tsx` only re-exports a component from `src/components/nav/`, plus a `default.tsx`.
  Mirror `@investmentCrumb`, the only instance.
- **`loading.tsx` is the only instant part of a navigation (EX-877)** — with PPR off, a prefetch carries
  layouts + `loading.tsx` only. A list route's `loading.tsx` renders `TitledPageLoading` with its title
  from `PAGE_TITLES` (`lib/constants/sections.ts`), the same constant the nav and heading read. `[id]`
  routes use `DetailPageLoading`; editor routes the bare `PageLoading`. `(frontend)/loading.tsx` stays
  untitled — every segment without its own inherits it.

### Where code lives

- `src/lib/db` — raw-SQL data access: **one statement plus its row mapper**, writes included. Auth,
  caching and view-shaping go to `src/lib/queries`; multi-step mutations to `src/lib/actions`
  (mutations only). A read a client component invokes on demand is a `'use server'` function in
  `src/lib/queries`.
- `src/scripts/data` — input data a one-off script reads at runtime. Test fixtures go to
  `src/__tests__/fixtures/`, or `e2e/fixtures/` for files a Playwright spec or E2E seed uploads.
- Per-feature schemas/hooks live under `src/components/forms/<form>/`; `src/types` is cross-feature only.
- **A hook's home follows its consumer count, counted in directories:** one form → `forms/<form>/`;
  two or more forms → `forms/hooks/` (domain-aware ones too); a non-form surface → `src/hooks/`.
  Promote when a second directory reaches for it, not a third file in the same one.
- **`src/components/ui/` is domain-agnostic and imports no feature directory** — not lint-enforced, so
  an upward import is how you spot a misplaced file. A component that knows it filters a list goes in
  `filters/`.
- **`src/components/tables/`** — per-domain column defs, the `column-meta.ts` augmentation, and the
  generic data-table engine in `tables/data-table/` (not `ui/`: its toolbar knows it's a data table).
- **The datasheet-grid seam runs one way:** `ui/datasheet-grid/` holds presentational cell primitives;
  `Column` factories that know what a figure means live in `kosztorys/editor/grid/cells/` (they take a
  domain `CellEditPolicyT`). A factory imports a primitive, never the reverse.

## Testing

**The file extension picks the runner:** `src/__tests__/**/*.test.ts` → node; `*.test.tsx` → jsdom with
`@testing-library/react`; Playwright specs under `e2e/` (`pnpm test:e2e`, against `db-test` on 5435).
Route a browser-level risk to the DOM layer first; Playwright only when it crosses client → server
action → DB → revalidation. Harness traps: `src/__tests__/AGENTS.md`.

- **Specs live under `src/__tests__`, never colocated** — `scripts/test-integration.sh` discovers DB specs
  by grepping that tree, so a colocated spec never runs in pre-push. Mirror the source path in full,
  every directory included: `src/lib/db/x.ts` → `src/__tests__/lib/db/x.test.ts`. A spec for a
  `components/**` module goes under `__tests__/components/**`, even when its subject is kosztorys logic.
- Start from a risk in `context/foundation/test-plan.md`, never from "cover this file"; extend the plan
  with `/10x-test-plan` for an uncovered risk. Then route: **new code test-first** → `/10x-tdd`;
  **protecting existing code** → `/10x-research` → `/10x-plan` → `/10x-implement`; **browser-level
  risk** → `/10x-e2e`.
- **A browser-level slice owes its E2E:** author it at the review gate or file it as a Linear issue
  labelled `e2e-backlog`. "Deferred to `/10x-e2e`" in a commit message does not discharge it.
- **A bug that slipped past the tests gets a failing test first**, then the fix — asserting persisted /
  observable state, not the action's return value (a success result can hide a failed write).
- Manual verification profile (safe DB, boot, logins, browser traps): `context/reference/manual-verification.md`.

## Stack Notes

- **Vercel is on a PAID plan** — Hobby limits (2 daily crons, 2K Blob ops) don't apply; a new scheduled
  job is a new `vercel.json` entry.
- React Compiler is on — no hand-written `useMemo` / `useCallback`.
- **The app speaks the viewer's account language (EX-996)** via `AppLanguageProvider`, falling back to
  Polish. Make a shared component translatable in place (`useTranslation(ns)` or a translator defaulting
  to `POLISH_<ns>`). **Never translate through the `lib/constants/transfers.ts` label maps** — sheet sync
  and the Payload graph read them as Polish; add a translator parameter beside them.
- **Phone scope is narrow (EX-785):** at 390px only navigation, adding and showing transactions, the
  worker report page `(share)/z/[investment]/[name]/[token]` (EX-947), an EMPLOYEE's own
  `/pracownicy/[id]` (EX-985) and the „Manual Wykończymy" dialog (EX-1032) must work. The kosztorys editor
  is desktop-only. No app-wide touch-target floor.
- **Breakpoints are overridden** in `src/styles/globals.css`: `sm`=768, `md`=1024, `lg`=1280. `sm:` is the
  single mobile→desktop break; both an upstream `sm:` and `md:` become `sm:` here (EX-624). Never add a
  640 breakpoint.
- A `console.error` that must become a Sentry capture gets a `// TODO(EX-958) SENTRY-REQUIRED:` marker.

## Environment Variables

Read env only through `src/lib/env/` — never raw `process.env` (ESLint enforces it; `NODE_ENV` excepted).
Client entry `env` (`env/index.ts`), server entry `serverEnv` (`env/server.ts`), schemas in `env/schema.ts`.

- `env/server.ts` is `server-only` — never import it from the Payload CLI graph (`payload.config.ts`,
  collections), where it throws under `payload generate:types`. That's why `payload.config.ts` is the one
  file allowed raw `process.env`.
- `(frontend)/layout.tsx` imports both entries as the build gate — don't delete those seemingly-unused imports.
- Tests alias both entries to passthrough stubs (`src/__tests__/stubs/`).

## Backlog & Task Tracking

- **Slices:** `context/foundation/roadmap.md` is the source of truth (`F-01`, `S-01`…, each with a `Status`).
- **Todos, live status and tech debt:** Linear project **"Wykonczymy"** (team Ex-plant) only — no second
  todo file, no separate tech-debt project (a "Wykonczymy v2" never existed). Record refactor findings
  there, not in a standalone audit doc. The moment you start work with a Linear issue, flip it to In
  Progress; Done when complete. If the Linear MCP isn't connected, update `roadmap.md` instead of
  claiming a Linear change.
- **Prose docs live under `context/`** (`foundation/` durable, `changes/` in-flight, `archive/` done,
  `reference/` standalone) — never a top-level `docs/`.
- **Doc lifecycle:** a one-off design/plan doc is not current truth — verify against code before quoting
  it. When a change ships, distill its durable rationale into a living doc, then archive the raw doc
  under `context/archive/<slug>/`. After any bigger change, update the relevant living doc.

## Common Commands

Scripts live in `@package.json`. Non-obvious ones:

```bash
pnpm build         # importmap + types + next build (NO migrate — see Migrations)
pnpm exec vitest run src/__tests__/some-file.test.ts  # single file — pnpm 10 no longer forwards `--`
pnpm generate:types  # regenerates src/payload-types.ts
INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts       # realistic kosztorys from the test sheet
INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts  # synthetic ~1000-item perf dataset
```

Both seed scripts wipe that investment's kosztorys first.

**Suites are serialized machine-wide.** Every heavy script (`test`, `test:integration`, `test:parity`,
`test:coverage`, `test:e2e*`) and the pre-push unit leg run under `scripts/with-test-lock.sh` — a
`mkdir` mutex on `/tmp/dev-test-suite.lock` shared across checkouts, worktrees and repos, because two
suites at once on this laptop take ~5× as long and fail on the clock. A single
`pnpm exec vitest run <file>` is deliberately **not** locked. `NO_TEST_LOCK=1` skips the lock.

### Migrations

- **Hand-write migrations** — `pnpm migrate:create` emits phantom drift (missing `.json` snapshots).
  Copy the latest file in `src/migrations/` and adjust FK constraints / internal Payload tables by hand.
- **`payload migrate` reads the working tree, not the branch** — in a shared tree it also applies other
  sessions' uncommitted migrations. Run `git status src/migrations` before migrating a shared DB.
- **The build does not migrate.** A human applies prod migrations with `pnpm db:migrate:prod` (dumps
  Neon first). Order follows the migration's direction: **additive** → migrate prod before pushing;
  **destructive** (`DROP COLUMN`) or a data rewrite the old code would misread → push first, migrate
  once the new deploy is live. A data rewrite says so with a `RUN-AFTER-DEPLOY` header marker; the
  `.husky/pre-push` gate reads it and detects a `DROP` in `up()` on its own. Skill:
  `payload-prod-migrate`.
- This is a **deploy-time** gate, not a phase gate — writing the migration and the code that reads it is
  one local task; never mark a plan phase "blocked on prod" while nothing is being pushed.

### Dependencies

Hand-edit `@package.json` instead of `pnpm remove` / `pnpm install` — on this arm64 machine they can swap
the native `lightningcss` binary to x64 and break the Tailwind/Turbopack CSS build with an error that
blames `globals.css`. Repair: `pnpm install --force`, `rm -rf .next`, restart dev.

## Databases

- **Local dev:** docker Postgres on 5433 (`docker compose up -d`; `DB_POSTGRES_URL`, db
  `wykonczymy-db`), restored from Neon dumps — `pnpm db:dump` (prod → `dumps/dump-latest.sql`, also run by pre-push) and `pnpm db:import`.
  Confirm before wiping it: a restore loses anything entered locally since the last dump.
- **E2E:** isolated `db-test` container on 5435 (`DB_POSTGRES_URL_TEST`, db `wykonczymy-test`). Reset with
  `pnpm db:import:test`; `pnpm test:e2e` starts the container but does not import. Seeds on top are per
  plane (`seed:materials-net:test` is required by the render-parity spec) — which counter needs which
  seed: `context/foundation/test-plan.md` §5.
- **Legacy client sheet dumps** live outside git: `context/reference/legacy-sheet-dumps.md`.
