# E2E Harness — Plan Brief

> Full plan: `context/changes/e2e-harness/plan.md`
> Research: `context/changes/e2e-harness/research.md`

## What & Why

Finish the Playwright harness scaffolded today (commit `a33b96d`) by adding an authenticated foundation and the first real browser-level specs. The current harness has only an unauthenticated login-page smoke test; nothing exercises the app's actual client→server-action→DB→revalidate→refresh boundary, which unit tests structurally cannot cover.

## Starting Point

`playwright.config.ts` already builds a fresh prod server (PORT 3100, `.next-e2e`), `@playwright/test` and `test:e2e` exist, and `.gitignore` reserves `/e2e/.auth/`. But there's no seeded user, no storageState, and no committed user-seed script (the `seed:transfers`/`seed:ziutek` entries point at missing files; `ADMIN`/`PASS` env vars are dead).

## Desired End State

`pnpm test:e2e` runs green against a fresh build with four specs: the existing smoke plus login→logout, create-expense→balance-updates, and create→cancel→audit-row. A `global-setup.ts` seeds an idempotent OWNER via the Local API and captures an authenticated session to `e2e/.auth/user.json` once per run.

## Key Decisions Made

| Decision                   | Choice                                | Why                                                                            | Source   |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Test-user role             | OWNER                                 | Clears every management gate without being ADMIN-only                          | Research |
| Seed timing                | Inside `global-setup.ts`              | One entry point owns auth state; no webServer command edit; identical local/CI | Plan     |
| CI workflow                | Deferred to a follow-up change        | Ships the local foundation faster; keeps this diff small                       | Plan     |
| CI browser (for follow-up) | Bundled Chromium                      | Deterministic, no system-Chrome dependency                                     | Plan     |
| Spec scope (round 1)       | Auth foundation + specs 1–3           | Proves storageState + the canonical revalidate/refresh boundary                | Plan     |
| Token-lifetime doc fix     | Fold in here                          | 7 days (`users.ts:15`), not the 24h AGENTS.md claims; trivial                  | Plan     |
| Assertion target           | Rendered UI state, not action returns | Lessons.md parity/bridge rule; avoids racing RSC refresh                       | Research |

## Scope

**In scope:** seed:e2e script, global-setup + storageState, config wiring, login→logout spec, create-expense and create→cancel specs, token-lifetime doc fix.

**Out of scope:** CI/GitHub Actions, role-redirect & invoice-upload specs, all Google-Sheets-sync specs, any env-layer or config-webServer changes.

## Architecture / Approach

`global-setup.ts` (runs after the webServer boots) calls a reusable `seedE2eUser()` (Local API, `context.skipRevalidation:true` — mandatory, else the Users afterChange hook throws), then logs in via the real UI (HTTP-only cookie can't be JS-set) and saves storageState. Authenticated specs opt in via `storageState`; the smoke spec stays unauthenticated. No global `storageState` (would break smoke).

## Phases at a Glance

| Phase                       | What it delivers                                          | Key risk                                                    |
| --------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Authenticated foundation | seeder + global-setup + config wiring + login→logout spec | Seed idempotency + `skipRevalidation`; storageState scoping |
| 2. Mutation specs           | create-expense→balance, create→cancel→audit               | Flake from RSC refresh timing; deterministic register data  |
| 3. Doc correction           | Fix 7-day token lifetime in 2 places                      | None (trivial)                                              |

**Prerequisites:** local docker Postgres up on 5433 with data (`pnpm db:import`); valid `.env`; system Chrome (config default).
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Mutation specs need a deterministic register/investment — reuse existing local fixtures rather than assuming data; may need a small seed extension if none is stable.
- `fullyParallel:false` keeps specs serial to avoid shared-register contention; fine for four specs.
- A `pnpm db:import` wipes the seeded user; global-setup re-creates it, so specs must not depend on stale rows.

## Success Criteria (Summary)

- `pnpm test:e2e` green with all four specs; `e2e/.auth/user.json` auto-generated and regenerable.
- Suite survives a DB reset (`pnpm db:import`) and 3 consecutive runs without flake.
- AGENTS.md + JWT docstring state the correct 7-day token lifetime.
