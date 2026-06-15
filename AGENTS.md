# AGENTS.md

Project-specific guidance for coding agents. Global conventions (response style, TypeScript / React / Next.js / Tailwind rules, git, tooling, personas) live in the user's global rules and are **not** repeated here. This file is only what's true for THIS repo and not inferable from the framework or `@package.json`.

## Project Overview

Business management dashboard for cash registers, transfers, investments, and employees. Next.js + Payload CMS. **Polish UI, English code.** Versions in `@package.json`.

## Backlog & Task Tracking

- **Canonical todo + slices:** `context/foundation/roadmap.md` — the v2 arc as slices (`F-01`, `S-01`…`S-10`) in dependency order, each with a `Status` field (`ready` / `proposed` / `blocked` / `done`). Start here for what to build next. Built from `context/foundation/prd.md` via `/10x-roadmap`; per-change plans land in `context/changes/<change-id>/` via `/10x-plan`.
- **Live status board:** Linear project **"Wykonczymy v2"**. When you start implementing a slice set its Linear issue to In Progress, and to Done when it's complete. **Reality-check Linear access first** — if the Linear MCP isn't connected, update the slice's `Status` in `roadmap.md` instead rather than claiming a Linear change you can't make.
- Refactor/cleanup backlog: see **Tech Debt** below. Client-notes todo: `docs/notes-todo.md`.

## Common Commands

Scripts live in `@package.json`. Non-obvious ones:

```bash
pnpm build         # generate:importmap + generate:types + migrate + next build
pnpm exec vitest run src/__tests__/some-file.test.ts  # single test file — pnpm 10 no longer forwards `--` to nested scripts
pnpm generate:types  # regenerate src/payload-types.ts (gitignored — never `git add` it)
docker compose up -d  # local Postgres on port 5433
```

### Migrations

`pnpm migrate:create` has emitted phantom drift since ~March 2026 (missing `.json` snapshots), so **hand-write migrations**: copy the structure of the latest file in `src/migrations/` and adjust FK constraints / internal Payload tables by hand. Don't trust an auto-generated migration blindly. `pnpm build` runs `payload migrate`.

### Dependencies

Prefer hand-editing `@package.json` over `pnpm remove` / `pnpm install`. On this arm64 machine those re-link `node_modules` and can swap the native `lightningcss` binary to x64 — dropping `lightningcss.darwin-arm64.node` and breaking the Tailwind v4 / Turbopack CSS build with an error that blames `src/styles/globals.css`. Repair: `pnpm install --force`, then `rm -rf .next` and restart dev. Detail: `context/foundation/lessons.md`.

## Databases And Live Data

- **The real DB is Neon Postgres** — `DB_POSTGRES_URL_PROD` in `.env` is the live prod credential (a single `ep-steep-unit` Neon branch; the former separate staging branch was deleted, so prod/staging are no longer split). **Never run SQL, migrations, or dumps-restores against the Neon URL**; a human applies prod migrations. A PreToolUse hook blocks prod-DB mutations.
- The local app points at the docker Postgres on 5433 (`DB_POSTGRES_URL`, db `wykonczymy-db`) — a copy restored from Neon dumps: `pnpm db:dump` (prod → `dumps/dump-latest.sql`, also run by the pre-push hook) and `pnpm db:import` (dump → local). Refreshable, but confirm before wiping it — a restore loses anything entered locally since the last dump.
- `GOOGLE_SERVICE_ACCOUNT_JSON` and `KOSZTORYS_TEMPLATE_SHEET_ID` in `.env` are real working credentials — Google Sheets writes hit live data.
- Never `git push`; a human pushes to remotes. A PreToolUse hook also blocks it.

## Architecture

### Route Groups

- `src/app/(frontend)` — main authenticated app
- `src/app/(auth)` — login page
- `src/app/(payload)` — Payload admin panel and API routes

### Important Directories

- `src/collections` — Payload collection configs
- `src/access` — role-based access control
- `src/lib/actions` — server actions for mutations
- `src/lib/queries` — server-side fetching and cached reference data
- `src/lib/auth` — JWT auth and roles
- `src/lib/db` — raw SQL financial calculations
- `src/lib/cache` — cache tags and revalidation helpers
- `src/components/forms` — TanStack React Form setup
- `src/components/ui` — Shadcn UI components
- `src/stores` — Zustand stores
- `src/types` — shared TypeScript types
- `src/migrations` — Payload migrations

## Auth And Roles

JWT auth via Payload using the `payload-token` cookie (24h lifetime). Roles: `ADMIN`, `OWNER`, `MANAGER`, `EMPLOYEE`. Hierarchy in `src/lib/auth/roles.ts`; access control functions in `src/access`.

## Mutation Pattern

All mutations go through `protectedAction()` in `src/lib/actions`:

- `'use server'`
- `requireAuth()`
- perf logging via `perfStart()`
- return `ActionResultT`
- trigger cache revalidation where needed

## Data Fetching And Cache

- Server components use `getPayload({ config })` or `fetchReferenceData()`
- Financial calculations use raw SQL via `@vercel/postgres`
- Cache uses `unstable_cache` with tag-based invalidation; `cacheComponents` and `'use cache'` are disabled because of a documented Vercel bug (see `docs/vercel-server-action-bug-report.md`)
- Revalidation differs by context: in **server actions** (`lib/actions`, `lib/cache/revalidate.ts`) use `updateTag()` for immediate expiration; in **Payload hooks** (`hooks/`) use `revalidateTag()` — hooks run in a Route Handler context where `updateTag` throws. Never import `lib/cache/revalidate.ts` from a Payload hook.
- Tags: `CACHE_TAGS.cashRegisters`, `.investments`, `.users`, `.transfers`

## Forms

- TanStack React Form via the custom `useAppForm()` hook (not React Hook Form)
- Optimistic updates use `useOptimisticFormStore` (Zustand), fire-and-forget

## Transfer Business Logic

The transfer-type union lives in `src/collections/transfers.ts` — read it there rather than trusting a copy (this list has gone stale before).

Non-obvious rules:

- `LABOR_COST` (robocizna) has **no source register** — it is a billing/markup figure, not a cash movement. It feeds the margin (`marża = robocizna − wypłaty − rabat − strata`), not the cash ledger.
- `CORRECTION` may be negative (invoice credits).
- `RABAT` (rabat) is a labour discount: **no source register**, positive amount, requires an investment. It hits **both** figures — lowers `marża` and raises `bilans` (the client owes less) — unlike `CORRECTION`, which moves only the balance.
- `LOSS` (strata) is a company-absorbed cost: **no source register**, positive amount, investment **optional**. It only lowers `marża`; `bilans` is untouched — unlike `RABAT`, which moves both.
- Cancellation is an audit trail: the original is marked `cancelled: true`, a new `CANCELLATION` row links back to it.
- Cash register balances are recalculated via Payload hooks on transfer create and delete.

How the financial figures (marża / materiały / robocizna / korekty) connect: `docs/investment-financials-and-discount.md`.

## Testing

Vitest unit specs under `src/__tests__` (aliases `@/*` → `./src/*`); single-file command in **Common Commands**. No E2E harness exists yet.

**Don't hand-roll tests or pick the layer by feel — route to a skill.** Always start from a named risk, never from "cover this file"; the cheapest layer that gives a real signal wins. The trap behind every bad test: assert observable behavior (persisted rows, recalculated balances, returned `ActionResultT`), not the implementation under test — the full anti-pattern lists are owned by the skills, don't restate them here.

- **New code, test-first** → **`/10x-tdd`** (when you can name the first failing test in one sentence and the impl isn't written yet).
- **Protecting existing code** → `/10x-research` → `/10x-plan` → `/10x-implement`, anchored on the risk.
- **Browser-level / multi-boundary risk** → **`/10x-e2e`** — but there is no Playwright setup in this repo yet, so setting one up is its own change, not a side effect of a test task.
- **A bug that slipped past the tests (test-driven debugging) — mandatory, not optional.** Reproduce it with a **failing test first**, then fix — never silently patch. Assert the **persisted / observable state, not the action's return value** — a success result can hide a failed write. The repro test stays as the regression guard for the path that had none.

There is no `context/foundation/test-plan.md` here yet — for a larger test rollout, generate one with `/10x-test-plan` first and anchor new tests on its risks.

## Project-Specific Code Style

- Do not add `readonly` to type properties, props, or parameters. If you touch a file with unnecessary `readonly`, remove it.

## Tech Debt

Known refactor/cleanup backlog (non-blocking, judgment-heavy): `docs/tech-debt-backlog.md`. Check it before starting a refactor, and record new findings there rather than spawning a new audit doc.

## Stack Notes

- React Compiler is enabled — don't hand-write `useMemo` / `useCallback` for things it handles
- `src/app/(payload)/layout.tsx` must include `importMap`, `serverFunction`, and `handleServerFunctions`

## Environment Variables

Validated at startup in `src/lib/env.ts` — read there for the current required list.
