# Kosztorys numeric cells commit on settle — Plan Brief

> Full plan: `context/changes/2026-10-20-kosztorys-commit-on-settle/plan.md`

## What & Why

Every keystroke in a numeric kosztorys cell rewrote the row and re-ran the whole editor over ~1000
rows. Writing once on Enter/Tab/blur/unmount cut the median keystroke from 49 to 31 ms (the metric
floor) in an interleaved staging-vs-preview A/B; the owner's vibe check passed.

## Starting Point

Spike `dc612530e` moves the write from `change()` to `settle()` in `useCellDraft`. The settle logic
around it still assumes the row holds the half-typed value: it snapshots the entry, rolls back
prefixes, and restores on Esc.

## Desired End State

The draft never touches the row. Settle writes once, or writes nothing and announces a refusal. Esc
writes nothing. Undo is one step per number. The rollback machinery is gone from the lib and all five
policies.

## Key Decisions Made

| Decision                        | Choice                  | Why                                                        | Source         |
| ------------------------------- | ----------------------- | ---------------------------------------------------------- | -------------- |
| Live totals while typing        | Dropped                 | Owner: they only cause problems; search stays live         | Linear EX-1116 |
| Guard spec for keystroke budget | Dropped                 | Measured A/B is the proof; spec was weak in jsdom          | Linear EX-1116 |
| Undo retraction fold            | Kept                    | Long-text Escape still writes a there-and-back             | Plan           |
| Long-text cells                 | Out of scope            | Not measured; own A/B if wanted                            | Plan           |
| Settle contract                 | commit / clear / reject | Row is never dirty, so no entry snapshot or rollback write | Plan           |

## Scope

**In scope:** `cell-edit.ts` settle contract, 4 policy files, `useCellDraft`, lib + DOM cell specs,
harness commit, perf doc bullet, lesson wording.

**Out of scope:** long-text cells, undo fold, `ui/decimal-field.tsx`, editor memoization.

## Phases at a Glance

| Phase                 | What it delivers                        | Key risk                                                      |
| --------------------- | --------------------------------------- | ------------------------------------------------------------- |
| 1. Settle-only commit | No rollback model; specs re-pinned      | A policy helper that looks dead but isn't — gate on typecheck |
| 2. Harness and docs   | Harness committed, docs match the model | —                                                             |

**Prerequisites:** worktree `.worktrees/ex-1116-commit-on-settle`, branch `perf/ex-1116-commit-on-settle`.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Closing the tab mid-typing loses the draft (accepted).

## Success Criteria (Summary)

- Typing in a 1000-row kosztorys feels instant; figures update on Enter.
- Esc and refused values never change the stored value.
- Kosztorys specs green.
