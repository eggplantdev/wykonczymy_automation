# Harden bulk-INSERT restore — Plan Brief

> Full plan: `context/changes/ex-430-harden-bulk-insert-restore/plan.md`

## What & Why

`restoreKosztorys` reverts a kosztorys to a snapshot by wipe → bulk re-insert → settings. The re-insert
maps old→new row ids **by array position**, relying on Postgres returning `RETURNING` rows in `VALUES`
order — true today, not SQL-guaranteed. If it ever broke (partitioning, a switch to `INSERT … SELECT`),
child rows would remap to the **wrong parents silently**. This change removes that reliance and pays
down three owed tests from the S-06 review gate.

## Starting Point

Two shared primitives (`insert-rows.ts`) plus an inline stages insert (`insert-kosztorys-tree.ts`)
return new ids as a positional array; three callers (restore, applyPreset, appendPresetSections) zip
them back to inputs by index. Covered only by a small-tree roundtrip test + a restore-action test.

## Desired End State

All id-mapping keys off each row's batch-unique natural key returned by `RETURNING` (section →
`displayOrder`, item → `(sectionId, displayOrder)`, stage → `ordinal`), never position. Three tests
guard restore: rollback-on-error, wide-field roundtrip, schema-drift. All green in the pre-push gate.

## Key Decisions Made

| Decision                  | Choice                   | Why                                                        | Source       |
| ------------------------- | ------------------------ | ---------------------------------------------------------- | ------------ |
| RETURNING-order risk      | Fix now, not defer       | Failure mode is silent wrong-parent remap — worst kind     | Plan (owner) |
| Id-map mechanism          | Natural-key RETURNING    | No typed-array unnest; minimal diff; robust to any reorder | Plan (owner) |
| Rollback test injection   | Spy-throw on last insert | Deterministic, hits the real half-wiped danger window      | Plan (owner) |
| Parameter-limit chunking  | Not doing                | ~10× headroom; EX-432 (Done) removed the ugly interaction  | Ticket       |
| Validation / hooks bypass | Not doing                | Accepted bypasses                                          | Ticket       |

## Scope

**In scope:** natural-key id-mapping in all 3 insert paths; rollback-on-error test; wide-field
roundtrip; schema-drift guard.

**Out of scope:** parameter-limit chunking, snapshot validation, re-adding hooks, any API/UX change,
the progress insert (no id remap).

## Architecture / Approach

Fix the two primitives + inline stages insert to `RETURNING id, <natural key>` and map by key; update
the two caller remap sites in lockstep. Existing roundtrip + restore-action tests are the regression net
for the refactor. Then add the three tests as independent phases.

## Phases at a Glance

| Phase                     | What it delivers                               | Key risk                                                 |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| 1. Natural-key id-mapping | Position-order reliance removed in all 3 paths | Caller remap sites must move in lockstep with primitives |
| 2. Rollback-on-error test | Atomicity + tx-handle tripwire                 | Spy must land throw in the danger window                 |
| 3. Wide-field roundtrip   | Column-mapping breadth (nulls/combos/unicode)  | none material                                            |
| 4. Schema-drift guard     | Fail-loud on additive schema change            | Getting the auto/defaulted exclusion set right           |

**Prerequisites:** local/test DB reachable (`ENV_READY`) for the integration specs.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- Natural keys are unique-in-batch (true by construction) — Phase 1 adds a defensive assertion.
- Phase 2 spy couples to insert-order internals — acceptable; it's also the intended upgrade tripwire.

## Success Criteria (Summary)

- Restore/apply/append never misparent children regardless of `RETURNING` order.
- A mid-restore throw leaves the live tree untouched (whole tx rolls back), proven by test.
- An added column that snapshots should carry fails the schema-drift guard loudly.
