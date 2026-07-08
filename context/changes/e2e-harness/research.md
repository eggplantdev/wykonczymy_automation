---
date: 2026-07-08T16:18:46+0200
researcher: ex-Plant
git_commit: acd24192c1f585aa003e8b9f4b25457ab8091dd7
branch: kosztorys-sections-items
repository: wykonczymy
topic: 'Standing up a Playwright E2E harness: auth, seeding, CI, and first real flows'
tags: [research, codebase, e2e, playwright, auth, ci]
status: complete
last_updated: 2026-07-08
last_updated_by: ex-Plant
---

# Research: E2E harness — auth, seeding, CI, first flows

**Date**: 2026-07-08T16:18:46+0200
**Researcher**: ex-Plant
**Git Commit**: acd24192c1f585aa003e8b9f4b25457ab8091dd7
**Branch**: kosztorys-sections-items
**Repository**: wykonczymy

## Research Question

What's needed to turn the current Playwright scaffold into a usable E2E harness — an authenticated + seeded foundation, CI wiring, and the first genuine browser-level flows? (Full scope.)

## Summary

**The premise "no Playwright setup yet" (AGENTS.md / project memory) is stale.** A harness already landed today in commit `a33b96d` — `test(e2e): stand up Playwright harness with a login smoke spec`:

- `playwright.config.ts` — builds a fresh **production** server (`pnpm build && pnpm start`) on port **3100** with `NEXT_DIST_DIR=.next-e2e`, `reuseExistingServer:false`, 300s timeout, `channel:'chrome'`, CI-aware (`forbidOnly`/`retries`/keys off `process.env.CI`).
- `e2e/smoke.spec.ts` — one **unauthenticated** test asserting `/zaloguj` renders Email/Hasło/Zaloguj. Its own comment defers "auth-flow and mutation specs (which need a seeded Payload user)" as follow-up.
- `@playwright/test ^1.50.0` devDep, `test:e2e` script, and `.gitignore` entries `/.next-e2e/`, `/playwright-report/`, `/e2e/.auth/` — the last reserving a storageState location.

So this change is **not** a greenfield setup. Three gaps remain to make the harness real: (1) an **authenticated foundation** — seed a Payload user + capture storageState via a global-setup; (2) **CI** — no test workflow exists at all; E2E belongs in a dedicated GitHub Actions workflow, **not** pre-push; (3) **first real specs** — a prioritized shortlist of browser-only risks.

## Detailed Findings

### Area 1 — Authenticated foundation (login + seed + storageState)

**Login flow**

- Server action `loginAction({email,password})` — `src/lib/actions/auth.ts:14-39`; calls Payload's `login()` from `@payloadcms/next/auth`, which sets the HTTP-only `payload-token` cookie itself (no token in the return value).
- Client form — `src/app/(auth)/zaloguj/login-form.tsx:23-35`; labels `Email` / `Hasło`, button `Zaloguj` (matches `e2e/smoke.spec.ts:9-11`), `router.push('/')` on success.
- Cookie/JWT verify — `src/lib/auth/get-current-user-jwt.ts:30-56`; `jwtVerify` with `PAYLOAD_SECRET` as key; reads `id/email/name/role` (requires `saveToJWT` on name+role, `src/collections/users.ts:49-54`).
- **Token lifetime correction:** `src/collections/users.ts:15` sets `tokenExpiration: 604800` = **7 days**, not the 24h AGENTS.md claims (the docstring in `get-current-user-jwt.ts:28` is also wrong).
- `requireAuth(readonly RoleT[])` — `src/lib/auth/require-auth.ts:15-27`; first guard in every action.

**Roles** — `src/lib/auth/roles.ts:1` `['ADMIN','OWNER','MANAGER','EMPLOYEE']`; `MANAGEMENT_ROLES` / `ADMIN_OR_OWNER_ROLES` at :14-16. Access fns in `src/access/index.ts`. **OWNER is the right test-user role** — clears every management gate without being ADMIN-only (matches project memory's temp-OWNER directive).

**Seeding — the crux**

- **No committed user-seed script exists.** `src/scripts/` has only `audit-investment-parity.ts` and `trigger-test-lead.ts`. The `seed:transfers` / `seed:ziutek` entries in `package.json:22-23` point at files that **don't exist** (stale).
- `ADMIN`/`PASS` in `.env` are **dead legacy vars** — no code reads them; don't use (confirmed by memory `project_local_login_and_test_fixtures.md`).
- Working pattern: a script run with `node --env-file=.env --import tsx src/scripts/<name>.ts` doing `getPayload({config})` then `payload.create({ collection:'users', data:{…role:'OWNER'}, context:{ skipRevalidation: true } })`. **`skipRevalidation` is mandatory** — outside a request context the Users `afterChange` revalidate hook (`src/collections/users.ts:32`) calls `revalidateTag` which throws. Template: `src/scripts/trigger-test-lead.ts:8-9,37-42`.

**Recommended approach** (from Agent 1, adjust in planning):

- Commit `src/scripts/seed-e2e-user.ts` — idempotent find-or-create OWNER `e2e@wykonczymy.test`, `context.skipRevalidation:true`; add `"seed:e2e"` script; run against **local docker DB on 5433 only, never prod**.
- Add `e2e/global-setup.ts` — log in once via the real UI (HTTP-only cookie can't be set from JS), `context.storageState({ path: 'e2e/.auth/user.json' })`; wire `globalSetup` in `playwright.config.ts` and give authenticated specs `use:{ storageState:'e2e/.auth/user.json' }` (keep smoke unauthenticated).
- **Seed-timing pitfall:** `globalSetup` runs _after_ the webServer is up, so seed before login — either prepend `pnpm seed:e2e &&` to the webServer command or `payload.create` inside global-setup before the browser step.

### Area 2 — Runtime env & CI

**Env gate is hard.** `src/app/(frontend)/layout.tsx:1-5` imports both `@/lib/env` and `@/lib/env/server` at module top; every route renders through it, so `next build` runs both `.parse()` calls. Required vars (`src/lib/env/schema.ts`, all `.min(1)`, no defaults):

- Client: `NEXT_PUBLIC_FRONTEND_URL` (must be a valid URL).
- Server (~17): `DB_POSTGRES_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `EMAIL_USER/PASS/HOST`, `META_APP_SECRET/APP_ID/APP_TOKEN/VERIFY_TOKEN/PAGE_ACCESS_TOKEN`, `LEADS_NOTIFY_EMAIL/ALERT_EMAIL/REPLY_FROM`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `KOSZTORYS_TEMPLATE_SHEET_ID`.
- Most can be **dummy non-empty strings** in CI, **except** `GOOGLE_SERVICE_ACCOUNT_JSON` — strict: valid JSON with `client_email` + `private_key` (`schema.ts:34-44`; a fabricated pair passes the gate, no real Google auth needed) and `NEXT_PUBLIC_FRONTEND_URL` (valid URL). `DB_POSTGRES_URL` only needs to be a string to pass the gate, but **runtime** (login, any page past `/zaloguj`) needs a **live DB**.
- `next.config.ts:8` `distDir: process.env.NEXT_DIST_DIR` — confirms the `.next-e2e` coupling the config relies on.

**Current automation**

- `.github/workflows/` has **only** `db-backup.yml`. **No test/CI workflow exists.**
- `.husky/pre-push` runs: prod-migration gate on `main` → `pnpm run typecheck` → `pnpm vitest run` → `pnpm test:parity` (DB-backed) → `pnpm db:dump` (Neon) → prune → background deploy watcher. **E2E is wired nowhere.**
- **Assessment: E2E does NOT belong in pre-push** (already does a full Neon dump per push; adding a `next build` + docker Postgres + system Chrome is too heavy/environment-dependent). Put it in a dedicated GitHub Actions workflow on PR/push; the config is already CI-aware.

**A GitHub Actions E2E workflow needs**

- A Postgres **service container** (`postgres:17-alpine` to match `docker-compose.yml`; `db-test` service on 5435 / `wykonczymy-test` is the natural template). Set `DB_POSTGRES_URL` to it.
- **Explicit schema apply** — build does NOT run migrations (removed from `pnpm build`). There's no generic `migrate` script; call `payload migrate` directly against the CI DB (don't reuse `db:migrate:prod`, `package.json:21` — it's prod-only and dumps first). **Never restore a prod dump into CI.**
- All required env vars as secrets (fabricated `GOOGLE_SERVICE_ACCOUNT_JSON`). `db-backup.yml` shows the secrets pattern.
- **Browser strategy:** config uses `channel:'chrome'` (system Chrome). CI runners lack it → either `npx playwright install chrome` (keep the channel) or switch CI to bundled Chromium (`playwright install --with-deps chromium`, drop the channel). Bundled Chromium is cleanest for CI.

### Area 3 — First real E2E flows

Mutation pattern: client TanStack form + `useFormSubmit` → `'use server'` action wrapped in `protectedAction` (`src/lib/actions/run-action.ts:32`: auth + payload + `revalidateCollections`) → Payload write (with `afterChange` recalc/sheet hooks) → `router.refresh()` re-renders RSC.

**Already unit-covered (~40 vitest files) — do NOT re-assert at E2E level:** transfer action logic & schemas, access-control/roles predicates, financial math (sum-transfers, calculate-balance/margin, settled-vs-unsettled, dashboard-aggregation), sheet mapping, optimistic-form-store, table/toggle/filter units. E2E asserts _cross-boundary wiring produces a visible UI change_, not numeric correctness.

**Prioritized shortlist (browser-only risks):**

1. **Login → dashboard → logout** (cookie/session round-trip) — `auth.ts:14/41`. Foundation for storageState; proves the cookie is set and honored by `requireAuth` on the next RSC request.
2. **Create expense → balance + table update same page** — `/kasa/[id]` or `/inwestycje/[id]`; `transfers.ts:76`, `expense-form.tsx:156`. Risk: `revalidateCollections(['transfers'])` + `router.refresh()` re-render (mocked away in units).
3. **Create → cancel with reason → CANCELLATION audit row + balance reverts** — `/kasa/[id]`; `transfers.ts:200`, `cancel-transfer-button.tsx`. Canonical multi-boundary flow (two writes: `cancelled:true` + audit row).
4. **Role redirect** — WORKER lands on own `/kasa/[id]`; non-privileged blocked from `/raporty` — `page.tsx:14-24`, `raporty/page.tsx:22`. RSC `requireAuth` + branching redirect/`notFound` only manifest in real navigation.
5. **Invoice upload → mediaId into transfer → invoice visible** — expense/edit dialog on `/kasa/[id]`; `upload-file-client.ts:6` (`POST /api/upload-file`), `invoice-upload-dialog.tsx:37`. Real multipart/network boundary.
6. **(Stretch) Optimistic submit failure recovery** — dialog reopens `failed` + repopulates retained `invoiceFiles`; `use-form-submit.ts:37`.

- **Excluded from round 1:** `applyMaterialSync` / kosztorys Sheets sync (`sheets-sync.ts:237`) — hits the **live Google Sheets API**; needs stubbing before it's stable. Higher-effort, later.

## Code References

- `playwright.config.ts` — webServer, PORT 3100, NEXT_DIST_DIR, CI flags
- `e2e/smoke.spec.ts:6-12` — unauthenticated smoke; defers auth/mutation specs
- `src/lib/actions/auth.ts:14-39` / `:41` — login/logout actions
- `src/lib/auth/get-current-user-jwt.ts:15-56` — JWT verify, PAYLOAD_SECRET key
- `src/collections/users.ts:15` — `tokenExpiration: 604800` (7 days), `:32` revalidate hook, `:49-54` saveToJWT
- `src/lib/auth/require-auth.ts:15-27`, `src/lib/auth/roles.ts:1,14-16`, `src/access/index.ts`
- `src/scripts/trigger-test-lead.ts:8-9,37-42` — Local-API script template
- `src/lib/env/schema.ts:9-49`, `index.ts:6-8`, `server.ts:1,8`; `src/app/(frontend)/layout.tsx:1-5` — env gate
- `next.config.ts:8` — `NEXT_DIST_DIR` → distDir
- `.husky/pre-push` — typecheck + vitest + parity + dump; no E2E
- `.github/workflows/db-backup.yml` — only workflow; secrets pattern
- `docker-compose.yml:4-6,13-23` — `db` (5433) / `db-test` (5435), postgres:17-alpine
- `src/lib/actions/run-action.ts:32` — `protectedAction` wrapper
- `src/lib/actions/transfers.ts:28,76,157-158,200,224-238` — create/bulk/cancel + `after()` sheet sync
- `src/stores/optimistic-form-store.ts`, `src/hooks/.../use-form-submit.ts:37`

## Architecture Insights

- **Two isolation dials make E2E coexist with `next dev`:** PORT 3100 + `NEXT_DIST_DIR=.next-e2e` + `reuseExistingServer:false` — the config already guards against silently testing a stale dev server (a documented flake source).
- **The env layer is the single hardest CI dependency**, not the DB — the module-top double import in the frontend layout means _every_ build parses the full server schema. CI must satisfy ~18 vars before a single page renders.
- **Schema is a human-owned plane** (migrations removed from build) — CI must apply `payload migrate` explicitly against a clean service DB; prod data must never enter CI.
- storageState + a single global-setup login is the standard way to avoid re-authenticating per spec; HTTP-only `payload-token` forces UI-driven or REST-login capture (can't inject from JS).

## Historical Context (from prior changes)

- `context/foundation/lessons.md` — parity-test lesson & settled-expense bridge lesson: **a test must run the real per-surface path on real data, proven red first.** Applies directly to E2E: the value of these specs is exercising the _actual_ revalidate→refresh boundary, not a mock.
- Project memory `project_local_login_and_test_fixtures.md` — ADMIN/PASS stale; temp OWNER via Local API with `skipRevalidation`; dev server often on 3001. Directly informs the seed script.
- `feedback_no_premature_tests.md` / `feedback_no_tests_in_poc_phase.md` — don't write tests while iterating design; this is MVP-phase test infra, so it's in scope.

## Related Research

None prior for E2E in `context/`. This is the first.

## Open Questions

1. **Seed placement** — prepend `pnpm seed:e2e` to the webServer command vs. `payload.create` inside `global-setup.ts`? (timing + who owns the DB state).
2. **CI trigger + DB** — dedicated workflow on PR only, or push too? Confirm `payload migrate` against a fresh service DB is the intended schema path (no dump restore).
3. **Browser in CI** — keep `channel:'chrome'` (+ `install chrome`) or switch CI to bundled Chromium? (local keeps system Chrome either way).
4. **Sheets-touching flows** — defer all Google-API specs (`applyMaterialSync`) until a stubbing strategy exists; confirm none are in round 1.
5. **Correct AGENTS.md / docstring** — token lifetime is 7 days, not 24h; fold into this change or a separate doc fix.
