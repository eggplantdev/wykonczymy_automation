# Unit Suite Speed — Plan Brief

> Full plan: `context/changes/2026-10-18-unit-suite-speed/plan.md`
> Research: `context/changes/2026-10-18-test-suite-speed/research.md`

## What & Why

The pre-push unit leg (`node` + `dom`) costs 175 s wall / 725.8 user CPU-s, almost all of it module
import repeated per file. Run mock-free specs in shared module graphs, prebundle `date-fns` /
`react-day-picker`, seam the most-mocked dom modules so most dom specs qualify, and hide `tsc`
behind the single-worker integration leg.

## Starting Point

Both unit projects are fully isolated. `db-shared` already proves the shared-graph + `globalThis`
seam pattern (`setup/db.ts`). The research draft split reached 103 s / 373 CPU-s.

## Desired End State

Six projects (`node`/`node-shared`, `dom`/`dom-shared`, `db`/`db-shared`); a spec is isolated only if
it calls `vi.mock`/`vi.doMock`. ~140 of 162 dom specs run shared. Server actions and the top dom
modules are steered with `vi.mocked(...)`. Typecheck runs concurrently with integration.

## Key Decisions Made

| Decision          | Choice                                            | Why (1 sentence)                                                     | Source   |
| ----------------- | ------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Split depth       | Split + seam the top dom mocks                    | Seams move ~56 more dom specs to the shared graph                    | Plan     |
| Typecheck         | Background during integration, wait before parity | Integration is single-worker, so `tsc` uses idle cores               | Plan     |
| Isolation trigger | `vi.mock`/`vi.doMock`/`require.cache` only        | `vi.spyOn` + an `afterAll` restore and a `globalThis` toast are safe | Plan     |
| Per-file resets   | Setup top level, not `beforeAll`                  | Specs steer at module top level, after setup but before `beforeAll`  | Plan     |
| Action stubs      | Registered `vi.fn`s, still throwing by default    | Specs steer without `vi.mock`; un-steered calls stay loud            | Plan     |
| Leftover 22 specs | Stay isolated                                     | Their extra mocks are one-off modules — a seam each buys one file    | Plan     |
| `db:dump`, E2E    | Untouched                                         | User constraint; backup Action not fixed                             | Research |

## Scope

**In scope:** vitest projects + setups, `stubServerActions`, shared seam helper, ~80 dom spec
conversions, `package.json` test scripts, pre-push project list + typecheck overlap, harness doc.

**Out of scope:** `db:dump`, E2E levers, node-project mock seams, the 22 one-off-mock dom specs.

## Architecture / Approach

The partition reads each spec's source: no module mock → shared project. A shared jsdom window means
the dom setup resets navigation, auth, the optimistic store, `location` and the DOM per file. Seams
live on `globalThis` because setup files and mock factories re-run per file while cached modules keep
the instance they first imported.

## Phases at a Glance

| Phase                  | What it delivers                                | Key risk                                         |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------ |
| 1. Shared projects     | `node-shared` + `dom-shared`, hardened setup    | Cross-file leakage — caught by shuffled runs     |
| 2. Dom prebundle       | `date-fns`/`react-day-picker` optimized         | Low                                              |
| 3. Server-action seams | Throwing `vi.fn` stubs, action mocks removed    | Specs relying on a `vi.fn()` resolving undefined |
| 4. Top-module seams    | Editor context, uploads, current user, … seamed | Per-file factory values mis-ported               |
| 5. Pre-push overlap    | `tsc` alongside integration                     | Orphaned background `tsc` on early exit          |

**Prerequisites:** test-suite-speed shipped (`ac11af301`).
**Estimated effort:** ~2 sessions; Phases 3–4 are the bulk (spec conversions).

## Open Risks & Assumptions

- Leakage the analysis missed (clipboard, a module singleton) — the two shuffled gate runs exist for it.
- Measurement noise from other agents' load — compare user CPU-s, not only wall.

## Success Criteria (Summary)

- `pnpm test` passes, including twice under `--sequence.shuffle`, with no spec assertion changed.
- Unit leg below the research's 103 s / 373 CPU-s draft figure.
- A push no longer waits for `tsc` on its own.
