# Test Suite Speed (levers 1 + 2) — Plan Brief

> Full plan: `context/changes/2026-10-18-test-suite-speed/plan.md`
> Research: `context/changes/2026-10-18-test-suite-speed/research.md`

## What & Why

The pre-push DB legs still spend about a minute on two fixed costs:

- **22 DB specs run isolated.** Each pays ~1.2 s of module import, 27 s in total.
- **`test:parity` re-imports the 243 MB dump and re-seeds on every push.** That takes 27 s.

This plan removes both costs.

## Starting Point

Two things sort and set up the DB specs today:

- **Sorting.** `vitest.config.ts` sends any DB spec that calls `vi.mock` / `vi.doMock` / `vi.spyOn` to the isolated `db` project. `setup/db.ts` mocks only the session.
- **Test DB reset.** `db:reset:test` does a full import, migrate and three seeds. Integration resets only when the migrations change; otherwise it runs on whatever E2E or a manual check left in the DB.

## Desired End State

All 157 DB specs run in `db-shared`. Integration time drops from ~70 s to ≤ 40 s.

Both DB legs start from a fresh ~1.4 s clone of a seeded template. The template is rebuilt only when:

- a migration changes;
- a seed script changes;
- it is more than 7 days old;
- `pnpm db:template:test` forces it.

Measured savings are recorded against a baseline taken before any change.

## Key Decisions Made

| Decision                              | Choice                                                                            | Why (1 sentence)                                                                                              | Source          |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------- |
| Group B (flag-driven domain wrappers) | Global transparent seams in `setup/db.ts`                                         | ~10 s saved; same pattern as the session stub                                                                 | Plan            |
| Seam mechanism                        | `vi.fn(realExport)`, steered with `vi.mocked`, explicit per-file `mockReset` list | Transparent by default, so the 135 existing specs are unchanged; an explicit list avoids wiping stub defaults | Plan            |
| The `db` project                      | Kept as an escape hatch; regex narrowed to `vi.mock` / `vi.doMock`                | A future spec that truly needs a module mock still works, just slower                                         | Plan            |
| Template freshness                    | Fingerprint of migrations + seeds, plus a 7-day age limit and a manual force      | The dump changes every push, so a dump-keyed template would never be reused                                   | Research → Plan |
| Integration DB                        | Fresh clone on every run; the stamp logic is removed                              | Ends leftover-data flakes; one reset path                                                                     | Plan            |
| Leak proof                            | Integration green twice plus one shuffled-order run, per phase                    | Order-dependent leaks only show in another file order                                                         | Plan            |
| Measurement                           | Phase 0 baseline (median of 2), a column per phase, after-measurement at the gate | Savings are claimed against numbers taken the same way                                                        | User            |

## Scope

**In scope:**

- Template DB script.
- `db:reset:test` / `db:template:test`.
- `test-integration.sh` reset + arg passthrough.
- Moving groups A / B / C into `db-shared`.
- Seams in `setup/db.ts`.
- Harness docs.
- Baseline and after-measurement.

**Out of scope:**

- All E2E levers.
- `db:dump` placement and the failing backup Action.
- Running typecheck in parallel with integration.
- Unit-suite work.
- Changing `db:import:test`.

## Architecture / Approach

**Template lifecycle.** A shell script owns it:

- `ensure` rebuilds into `wykonczymy-test` when the template is stale, copies that to `wykonczymy-test-template`, and stores the fingerprint and build date as a DB comment;
- `clone` runs `DROP … WITH (FORCE)`, then `CREATE … TEMPLATE`.

**Spec moves.** Each moved spec loses its per-file `vi.mock` and overrides a global seam instead. `setup/db.ts` resets the seams in `beforeAll` and restores spies in `afterAll`, so nothing leaks between files that share one module cache.

## Phases at a Glance

| Phase             | What it delivers                                                           | Key risk                                                                            |
| ----------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 0. Baseline       | Median before-numbers for integration (total + per project), parity, reset | Noise from other load — runs go through the machine-wide test lock                  |
| 1. Template clone | `db:reset:test` ~27 s → ~2–3 s; clean DB every integration run             | `CREATE … TEMPLATE` fails while the source has sessions — backends terminated first |
| 2. Group A        | 4 `spyOn` specs in `db-shared`                                             | A spy surviving into the next file's `beforeAll` — `afterAll` restore               |
| 3. Group B        | 7 domain-wrapper specs in `db-shared`                                      | A seam override leaking into another file — per-file reset, shuffle run             |
| 4. Group C        | 11 external-service specs in `db-shared`; `db` project empty               | `settle-payouts` switches from an inline `after` to `flushAfter()`                  |

**Prerequisites:** the `db-test` container (5435) is up, and `dumps/dump-latest.sql` exists or can be dumped.
**Estimated effort:** ~1–2 sessions across 5 phases; most of the wall-clock is verification runs.

## Open Risks & Assumptions

- **Stale parity data.** Parity can run on prod data up to 7 days old; the golden master pins a committed fixture.
- **Real modules loaded once.** Wrapping a seam with `importOriginal` loads that module once in `db-shared`. This is assumed side-effect-free on import.
- **Wiped manual-check data.** Cloning wipes anything a manual check left on 5435, which parity already did on every push.

## Success Criteria (Summary)

- `test:integration` ≤ 40 s of vitest time, and parity's reset ~2–3 s, both measured against the Phase 0 baseline.
- No `vi.mock` / `vi.doMock` left in any DB spec; the `db` project is empty.
- Integration is green in default and shuffled order.
