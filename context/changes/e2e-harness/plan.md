# E2E Harness — Authenticated Foundation & First Specs Implementation Plan

## Overview

Finish the Playwright E2E harness that landed in commit `a33b96d` (config + one unauthenticated smoke spec). This change adds the authenticated foundation (a seeded OWNER user + a global-setup that captures storageState), then the first two mutation specs that exercise the app's real client→server-action→DB→revalidate→refresh boundary. A small doc correction (token lifetime) rides along. CI wiring is explicitly deferred to a follow-up change.

## Current State Analysis

- Harness scaffold already committed: `playwright.config.ts` (fresh prod server on PORT 3100, `NEXT_DIST_DIR=.next-e2e`, `reuseExistingServer:false`, 300s timeout, `channel:'chrome'`, CI-aware), `e2e/smoke.spec.ts` (unauthenticated `/zaloguj` render), `@playwright/test ^1.50.0`, `test:e2e` script. `.gitignore` already reserves `/.next-e2e/`, `/playwright-report/`, `/e2e/.auth/`.
- **No authenticated path exists** — smoke spec's own comment defers auth/mutation specs needing a seeded user.
- **No committed user-seed script.** `src/scripts/` has only `audit-investment-parity.ts` and `trigger-test-lead.ts`; `seed:transfers`/`seed:ziutek` in `package.json:22-23` point at missing files. `ADMIN`/`PASS` in `.env` are dead legacy vars.
- Login: `loginAction` (`src/lib/actions/auth.ts:14-39`) → Payload `login()` sets HTTP-only `payload-token`. Form labels `Email`/`Hasło`, button `Zaloguj` (`src/app/(auth)/zaloguj/login-form.tsx`). JWT verified with `PAYLOAD_SECRET` (`src/lib/auth/get-current-user-jwt.ts:15-56`).
- Roles: `src/lib/auth/roles.ts:1`. **OWNER** clears every management gate without being ADMIN-only — the right test-user role.
- Mutation pattern: TanStack form + `useFormSubmit` → `protectedAction` (`src/lib/actions/run-action.ts:32`: auth + `revalidateCollections`) → Payload write (+ `afterChange` recalc hooks) → `router.refresh()`. Create/bulk/cancel in `src/lib/actions/transfers.ts:28,76,200,224-238`.
- Full grounding: `context/changes/e2e-harness/research.md`.

## Desired End State

`pnpm test:e2e` runs green locally against a fresh production build with: the smoke spec (unauthenticated) plus three authenticated specs (login→logout, create-expense→balance-updates, create→cancel→audit-row). A one-time `global-setup.ts` seeds an idempotent OWNER via the Local API and logs in once, saving `e2e/.auth/user.json`; authenticated specs consume it via `storageState`. `AGENTS.md` and the JWT docstring state the correct 7-day token lifetime.

Verify: `pnpm test:e2e` passes with 4 specs; deleting `e2e/.auth/user.json` and re-running regenerates it; grep confirms no `24h`/`24-hour` token claim remains.

### Key Discoveries:

- HTTP-only `payload-token` **can't** be set from JS — global-setup must drive the real login UI (or POST `/api/users/login`); UI-driving is less brittle (`research.md` Area 1).
- `payload.create` for a user outside a request context **throws** unless `context:{ skipRevalidation:true }` — the Users `afterChange` revalidate hook (`src/collections/users.ts:32`) calls `revalidateTag` (`research.md` Area 1; memory `project_local_login_and_test_fixtures.md`).
- global-setup runs **after** the webServer is up, so it can seed via Local API before the browser login — no webServer command edit needed.
- Token lifetime is **7 days** (`src/collections/users.ts:15` `tokenExpiration: 604800`), not the 24h AGENTS.md + `get-current-user-jwt.ts:28` docstring claim.
- Env gate is hard: `src/app/(frontend)/layout.tsx:1-5` imports both env entries; `next build` parses the full server schema. Local `.env` already satisfies it (no change needed here) — this only matters for the deferred CI change.
- Lesson (parity/bridge, `context/foundation/lessons.md`): a test must run the **real** path on **real** data and be proven **red** first. These specs must assert observable UI state (visible row, updated balance), never an action's return value.

## What We're NOT Doing

- No GitHub Actions / CI workflow (deferred to a follow-up change; browser strategy for CI already decided: bundled Chromium — recorded for that change).
- No role-redirect spec, no invoice-upload spec (shortlist items 4–5).
- No Google-Sheets-sync specs (`applyMaterialSync`) — needs API stubbing first.
- No change to `playwright.config.ts` webServer command, PORT, or dist-dir isolation.
- No new required env vars; no touching the `src/lib/env` layer.
- Never seed or run against prod — local docker DB on 5433 only.

## Implementation Approach

Build the foundation and its proving spec together (Phase 1) so storageState is validated by an actual green login→logout run before layering mutation specs on it (Phase 2). Keep the seed logic inside `global-setup.ts` (chosen: single entry point owning auth state, identical local/CI, no config command edit) but factored so the create-or-find helper is reusable. Doc fix is isolated (Phase 3).

## Critical Implementation Details

**Timing & lifecycle** — `global-setup.ts` must seed the user (Local API, `skipRevalidation`) _before_ the browser login step, and both must resolve against the same DB the webServer uses; `PAYLOAD_SECRET` must be identical across seed and server (same `.env`, so fine). Make the seeder find-or-create idempotent — a `pnpm db:import` wipes the seeded user, and the suite may run repeatedly against a persistent local DB.

**User experience spec** — mutation specs assert on the _rendered_ result after `router.refresh()` (a new table row, an updated saldo value), not on any intermediate optimistic state, to avoid racing the RSC re-render.

## Phase 1: Authenticated Foundation + login/logout spec

### Overview

Seed an OWNER test user, capture an authenticated storageState once, wire it into the config, and prove the whole cookie round-trip with a login→dashboard→logout spec.

### Changes Required:

#### 1. E2E user seeder (reusable helper)

**File**: `src/scripts/seed-e2e-user.ts` (new)

**Intent**: Idempotently find-or-create the OWNER test user via the Payload Local API so authenticated specs have a stable identity; also export the credentials/creation as a function global-setup can call directly.

**Contract**: Export `seedE2eUser(): Promise<void>` (and exported `E2E_EMAIL`/`E2E_PASSWORD` constants) that does `getPayload({config})`, `payload.find` on email, and on absence `payload.create({ collection:'users', data:{ email, password, name:'E2E User', role:'OWNER' }, context:{ skipRevalidation:true } })`. Model the getPayload + `main().then(exit)` runner on `src/scripts/trigger-test-lead.ts:8-9,37-42`, but guard the CLI runner behind an `import.meta`/`require.main` check so importing the module (from global-setup) doesn't trigger `process.exit`. `skipRevalidation` is mandatory.

#### 2. package.json script

**File**: `package.json`

**Intent**: Allow running the seeder standalone for debugging/onboarding.

**Contract**: Add `"seed:e2e": "node --env-file=.env --import tsx src/scripts/seed-e2e-user.ts"` near the other `seed:*` entries.

#### 3. Global setup

**File**: `e2e/global-setup.ts` (new)

**Intent**: Once per run, ensure the user exists then log in through the real UI and persist storageState for authenticated specs.

**Contract**: Default-export `async (config: FullConfig)`: call `seedE2eUser()`, launch `chromium` with `channel:'chrome'`, `page.goto('/zaloguj')`, fill `getByLabel('Email')`/`getByLabel('Hasło')`, click `getByRole('button',{ name:'Zaloguj' })`, `waitForURL('/')`, `context.storageState({ path:'e2e/.auth/user.json' })`, close. baseURL from `config.projects[0].use.baseURL`.

#### 4. Playwright config wiring

**File**: `playwright.config.ts`

**Intent**: Register global-setup and give authenticated specs the stored session while keeping the smoke spec unauthenticated.

**Contract**: Add `globalSetup: './e2e/global-setup.ts'`. Do **not** set a global `storageState` (that would break the unauthenticated smoke spec). Authenticated specs opt in via a per-file/`test.use({ storageState: 'e2e/.auth/user.json' })` — or a second project scoped to authenticated specs. Keep `webServer.command` unchanged.

#### 5. Spec: login → dashboard → logout

**File**: `e2e/auth.spec.ts` (new)

**Intent**: Prove the cookie is set on login, honored by `requireAuth` on the next RSC request (dashboard renders), and cleared by logout.

**Contract**: Unauthenticated test (no storageState): go to `/zaloguj`, log in, assert redirect to `/` and a dashboard-only element is visible; trigger logout (`logoutAction`, `src/lib/actions/auth.ts:41`) and assert redirect back to `/zaloguj`. Assert observable navigation/DOM, not action returns.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- `pnpm seed:e2e` creates the user and is idempotent on a second run (no error, no duplicate)
- `pnpm test:e2e` passes with the smoke + auth specs; `e2e/.auth/user.json` is generated

#### Manual Verification:

- Deleting `e2e/.auth/user.json` and re-running `pnpm test:e2e` regenerates it and stays green
- The OWNER user appears in the local Payload admin (docker DB 5433), not prod

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 2.

---

## Phase 2: Mutation specs (balance update + cancel/audit)

### Overview

Two authenticated specs that exercise the revalidate→refresh boundary the unit suite mocks away.

### Changes Required:

#### 1. Spec: create expense → balance + table update

**File**: `e2e/transfer-create.spec.ts` (new)

**Intent**: Assert that submitting the expense form causes `revalidateCollections(['transfers'])` + `router.refresh()` to surface the new row and an updated saldo on the same page without reload.

**Contract**: Uses `storageState`. Navigate to a `/kasa/[id]` (or `/inwestycje/[id]`) with a known register, open the expense form (`src/components/forms/.../expense-form.tsx:156`), submit a small expense, assert the new row is visible and the `SaldoDisplay` value changed. Pick/seed a deterministic register — reuse an existing local one (memory: use existing test fixtures) rather than assuming data. Assert rendered state, not the action return.

#### 2. Spec: create → cancel with reason → audit row + balance reverts

**File**: `e2e/transfer-cancel.spec.ts` (new)

**Intent**: Prove the two-write cancel flow (`cancelled:true` on original + a `CANCELLATION` audit row, `src/lib/actions/transfers.ts:200,224-238`) surfaces as both a visible audit row and a reverted balance after refresh, including the cancel dialog's min-length reason gating (`cancel-transfer-button.tsx`).

**Contract**: Uses `storageState`. Create a transfer, open cancel, assert the confirm is blocked/disabled until the reason meets min length, submit a valid reason, assert a CANCELLATION row is visible and the balance returns to its pre-create value. Assert observable DOM/state.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- `pnpm test:e2e` passes with all four specs (smoke + auth + create + cancel)

#### Manual Verification:

- Specs are not flaky across 3 consecutive `pnpm test:e2e` runs
- After a `pnpm db:import` (DB reset), the suite still passes (global-setup re-seeds; specs don't depend on stale rows)

**Implementation Note**: Pause for human confirmation of flake-check before Phase 3.

---

## Phase 3: Doc correction — token lifetime

### Overview

Fix the incorrect 24h token-lifetime claim in two places.

### Changes Required:

#### 1. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Correct the auth section's token lifetime.

**Contract**: In the "Auth And Roles" section, change "24h lifetime" to "7-day lifetime" (source of truth: `src/collections/users.ts:15` `tokenExpiration: 604800`).

#### 2. JWT docstring

**File**: `src/lib/auth/get-current-user-jwt.ts`

**Intent**: Correct the docstring near line 28 that says 24h.

**Contract**: Update the comment to say 7 days; no behavior change.

### Success Criteria:

#### Automated Verification:

- No stale claim remains: `grep -rniE '24[ -]?h(our)?' AGENTS.md src/lib/auth/get-current-user-jwt.ts` returns nothing token-related
- Typecheck passes: `pnpm typecheck`

#### Manual Verification:

- The corrected figure matches `src/collections/users.ts:15`

---

## Testing Strategy

### Unit Tests:

- None added — E2E is the right layer for these cross-boundary risks; the ~40 vitest specs already cover transfer action logic, schemas, roles, and financial math (do not duplicate at E2E level, `research.md` Area 3).

### Integration Tests (E2E):

- Smoke (existing), login→logout, create-expense→balance-update, create→cancel→audit-row.

### Manual Testing Steps:

1. `pnpm seed:e2e` then confirm the OWNER user in the local admin panel.
2. `pnpm test:e2e` — all four specs green.
3. Delete `e2e/.auth/user.json`, re-run — regenerates and passes.
4. Run the suite 3× to check for flake.

## Performance Considerations

The webServer does a full `pnpm build` per run (300s budget) — expected and isolated to `.next-e2e`. `fullyParallel:false` keeps specs serial to avoid cross-spec DB contention on shared registers; acceptable for four specs.

## Migration Notes

None — no schema changes. The seeded user is data-plane only and idempotent; a `pnpm db:import` removes it and global-setup re-creates it.

## References

- Research: `context/changes/e2e-harness/research.md`
- Login action: `src/lib/actions/auth.ts:14-39`, `:41`
- JWT verify / token: `src/lib/auth/get-current-user-jwt.ts:15-56`, `src/collections/users.ts:15`
- Seed template: `src/scripts/trigger-test-lead.ts:8-9,37-42`
- Transfer actions: `src/lib/actions/transfers.ts:76,200,224-238`
- Existing harness: `playwright.config.ts`, `e2e/smoke.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Authenticated Foundation + login/logout spec

#### Automated

- [x] 1.1 Typecheck passes: `pnpm typecheck` — 6c941b6
- [x] 1.2 Lint passes: `pnpm lint` — 6c941b6
- [x] 1.3 `pnpm seed:e2e` creates the user and is idempotent on re-run — 6c941b6
- [x] 1.4 `pnpm test:e2e` passes with smoke + auth specs; `e2e/.auth/user.json` generated — 6c941b6

#### Manual

- [ ] 1.5 Deleting `e2e/.auth/user.json` and re-running regenerates it and stays green
- [ ] 1.6 OWNER user appears in local admin (5433), not prod

### Phase 2: Mutation specs (balance update + cancel/audit)

#### Automated

- [x] 2.1 Typecheck passes: `pnpm typecheck`
- [x] 2.2 Lint passes: `pnpm lint`
- [ ] 2.3 `pnpm test:e2e` passes with all four specs

#### Manual

- [ ] 2.4 Specs not flaky across 3 consecutive runs
- [ ] 2.5 Suite passes after a `pnpm db:import` DB reset

> **WIP status (2026-07-08, branch switch):** auth + smoke specs GREEN and stable. Both mutation
> specs (transfer-create, transfer-cancel) still RED: the created expense row never appears on the
> `/kasa/[id]` page within the 20s `expect` timeout on a cold server — `getByRole('cell', {name:
description})` times out with "element(s) not found" (see `test-results/…/error-context.md`). The
> dialog closes (submit fires), so the write likely succeeds but the revalidate → router.refresh
> round-trip doesn't surface the row on the register list within budget. Next: run against the WARM
> server (`pnpm test:e2e:warm`, see `playwright.warm.config.ts`) to isolate cold-boot latency from a
> genuine "row never renders" bug — if warm also fails, the assertion/selector is wrong, not slow.
> DB isolation to 5435 is DONE and verified (scripts force `db-test`, config hard-throws without
> `DB_POSTGRES_URL_TEST`).

### Phase 3: Doc correction — token lifetime

#### Automated

- [ ] 3.1 No stale 24h claim remains (grep)
- [ ] 3.2 Typecheck passes: `pnpm typecheck`

#### Manual

- [ ] 3.3 Corrected figure matches `src/collections/users.ts:15`
