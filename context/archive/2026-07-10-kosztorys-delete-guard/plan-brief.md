# Kosztorys Delete-Guard (S-08) — Plan Brief

> **SUPERSEDED by EX-477 (2026-07-17).** The hard-block policy this doc describes was reversed to
> **confirm-then-snapshot** — a populated item/section/stage now deletes behind a confirm dialog
> after a pre-delete auto snapshot, instead of being rejected. Current truth:
> `context/changes/kosztorys-delete-confirm/change.md`. This doc is kept for history only.

> Full plan: `context/changes/kosztorys-delete-guard/plan.md`

## What & Why

Hard-block deleting a kosztorys **item** or **section** that still holds measured/executed values, so
a manager can't silently cascade-delete recorded work. Today a section delete FK-cascades through
items into `stage_progress` with nothing to stop it — the exact loss the existing stage guard exists
to prevent, but unprotected on the item/section paths.

## Starting Point

`removeStageAction` already blocks deleting a stage with recorded progress (SQL check,
`src/lib/actions/kosztorys.ts:286`). `removeItemAction` / `removeSectionAction` have no guard and are
fire-and-forget optimistic in the UI (no error surfacing). A column = a stage, so the "column" half
of the old slice is already done.

## Desired End State

Deleting a populated item/section is rejected server-side (row/section survives) and blocked in the
UI with a toast — no vanish-then-reappear. Plan-only rows (przedmiar/price, never measured) still
delete instantly. Stage-column delete unchanged.

## Key Decisions Made

| Decision              | Choice                                                                             | Why                                                                                | Source   |
| --------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| "Populated" predicate | `measured_qty <> 0` OR any `stage_progress.qty_done <> 0`                          | Protects expensive on-site data + cascade loss; keeps deleting fresh mistakes easy | Plan     |
| Blocked-delete UX     | Client pre-check (block + toast, no optimistic remove) + server guard as authority | No flicker, instant feedback; server stays source of truth                         | Plan     |
| Enforcement placement | Server action (not collection hook / DB trigger)                                   | Mirrors the existing stage guard                                                   | Plan     |
| Testing               | Unit-test the server guards, red-first, assert persisted state                     | Cheapest real signal; E2E is band 3 (S-13)                                         | Plan     |
| Column/stage case     | No change                                                                          | `removeStageAction` already guards it                                              | Research |

## Scope

**In scope:** SQL populated-guards on `removeItemAction` + `removeSectionAction`; convert the two
optimistic UI handlers to pre-check + toast; red-first unit tests.

**Out of scope:** role-based visibility (S-10 RBAC); snapshots (S-06); soft-delete; collection-hook
enforcement; E2E specs; the stage guard (already done); the ≥1-item invariant (unchanged).

## Architecture / Approach

Server-first. Phase 1 adds the authoritative SQL existence checks (one indexed `LIMIT 1` query each)
returning the existing `ActionResultT` failure shape, locked by unit tests asserting DB state. Phase 2
wires the UI: a shared pure predicate helper (`measuredQty` + stage progress) drives a client
pre-check that toasts and returns before any optimistic removal, with await+revert as a backstop.

## Phases at a Glance

| Phase                    | What it delivers                                                   | Key risk                                                               |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1. Server guards + tests | Item + section deletes reject when populated; red-first unit tests | Predicate edge cases (NULL numeric cols → use `<> 0`)                  |
| 2. UI pre-check          | Toast-on-block, no flicker; server backstop                        | Client/server predicate drift (keep helper thin, server authoritative) |

**Prerequisites:** S-01 (editor + delete actions) — shipped. None else.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Client and server predicates live in two planes; drift would let the UI mis-block. Mitigation: thin
  shared helper, matching field names, server as authority (`lessons.md` two-plane rule).
- Assumes grid rows already carry `measuredQty` + per-stage progress for the client pre-check (they do).

## Success Criteria (Summary)

- Populated item/section: delete blocked, data persists, toast shown.
- Plan-only item/section: still deletes instantly.
- Stage-column delete still blocks on recorded progress (regression intact).
