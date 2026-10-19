# App audit and refactor — Plan Brief

> Full plan: `context/changes/2026-10-19-app-audit-refactor/plan.md`
> Research: `context/changes/2026-10-19-app-audit-refactor/research.md`

## What & Why

Audit and refactor all app code under `src/` (tests were done separately) before the next features
land, so new work starts on clean boundaries. Every directory is read, refactored, and clicked
through under the roles it serves; every finding lands in one ledger.

## Starting Point

The code is mostly healthy (0.17 % duplication, no dead files). The value sits in the kosztorys
editor pair, the `lib/actions` ↔ `lib/db` boundary, Payload hooks living in `src/hooks`, ~13 small
duplication sites, guards that don't run, and three access gaps.

## Desired End State

Every Directories-table row ticked; `ui/` layering enforced by lint; no
read in `lib/actions`, no flow in `lib/db`, no Payload hook in `src/hooks`; no hand-written memo in a
file the compiler compiles; the editor hook and body split into focused parts; MANAGER can't toggle
a register; EMPLOYEE on `/kasa/{id}` lands on his own page.

## Key Decisions Made

| Decision                                   | Choice                                                                                             | Why                                                                        | Source       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------ |
| MANAGER toggling a register's active state | Block: server refusal + no toggle in the table                                                     | Matches the form and `withinManagerScope`, which already strip `active`    | Owner        |
| Hand-written `useMemo`/`useCallback` (96)  | Guard first (compiler coverage + compiler lint diagnostics + behaviour specs), then strip per file | Stripping a file the compiler bails out on removes all its memoization     | Owner + Plan |
| `/kasa/[id]` for EMPLOYEE                  | `requireManagementPage`, keep the MAIN-register 404 for MANAGER                                    | Same gate as every other `[id]` page                                       | Owner + Plan |
| Order                                      | Guards → access → `lib` → boundary → Payload hooks → components → memos → editor                   | Machine checks before moves; best-netted layers first; riskiest last       | Research     |
| Payload hooks' new home                    | `src/collections/hooks/`                                                                           | Beside the collections that register them; `src/hooks` = React only        | Plan         |
| `sheets-sync` helpers                      | Plain server module                                                                                | Can't become an unauthenticated action; breaks the hook → action cycle     | Research     |
| Browser checks                             | Manual-checks registry; agent drives the browser only on the user's go                             | Standing rule: no browser unless asked in that session                     | Plan         |
| dependency-cruiser                         | Cycle meter during this change, removed at archive                                                 | Never run since the June map; other rules duplicate ESLint, build and knip | Plan         |
| Record                                     | `ledger.md`, one checkbox per finding, codes `DUP/LAYER/CYCLE/DEAD/ACCESS/BUG/MEMO/GOD/NOISE`      | Mirrors the test-suite audit                                               | Research     |

## Scope

**In scope:** everything under `src/` except `__tests__`, `migrations`, `payload-types.ts`; the `ui/` lint guard; the three owner decisions; bugs proven by a failing test.

**Out of scope:** behaviour changes beyond those; persisted keys, slugs, tags, URLs; accepted owner
rulings (COMPANY_FUNDING, LABOR_COST/RABAT, MANAGER props); merging kosztorys and szablon tables;
new E2E unless a risk is uncovered.

## Phases at a Glance

| Phase                     | What it delivers                                             | Key risk                                                 |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| 1. Guards and ledger      | `ui/` import rule, depcruise cut to a cycle meter, baseline  | Making `ui/` pass needs component moves                  |
| 2. Access fixes           | Register toggle, `/kasa/[id]`, sheet helpers, `BalanceCell`  | Sheet sync path breaks silently locally (Viewer account) |
| 3. `lib/*` cleanups       | Sort factory, uniqueness, `trashedAt`, label maps, dead code | Option labels drift                                      |
| 4. Boundary               | Reads to queries, flows to actions, `kosztorys.ts` split     | Losing the transaction handle                            |
| 5. Payload hooks move     | `src/collections/hooks/`, guards and AGENTS.md follow        | Rules keyed on old paths                                 |
| 6. Components             | Hook homes, dedup, cycles, `line-items-field` split          | Weakest test net; click-through carries it               |
| 7. Memos (outside editor) | Coverage script, specs, strip 44 memos                       | Compiler bailouts                                        |
| 8. Editor split           | Sub-hooks, body by mode, 52 memos, cycles                    | Perf on ~1000-row kosztorys                              |

**Prerequisites:** none — the in-flight `delete-invoice-media` work landed in `380b54550`.
**Estimated effort:** ~8 sessions, one per phase; Phases 6 and 8 may take two.

## Open Risks & Assumptions

- `components/*` has thin unit coverage; regressions there surface only in `tsc`, E2E and the
  click-through.
- A memo the compiler can't cover stays; the plan accepts a non-zero remainder if ledgered.
- Phase 1 baseline may reveal lint errors nobody has seen (lint runs on staged files only).

## Success Criteria (Summary)

- Each role clicks through its surfaces after every phase with no visible change except the two
  access decisions.
- The whole-tree gate (typecheck, lint, unit, integration, build, user-run E2E) passes.
- The ledger has no open box.
