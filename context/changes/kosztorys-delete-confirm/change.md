---
change_id: kosztorys-delete-confirm
title: Confirm-gated, snapshot-backed delete for populated item / section / stage (EX-477)
status: done
created: 2026-07-17
updated: 2026-07-17
archived_at: null
branch: refactor/kosztorys-dogfooding-followups
worktree: null
supersedes: kosztorys-delete-guard (S-08 hard-block policy)
linear: EX-477 (subsumes EX-507)
---

## What changed & why

The original S-08 `kosztorys-delete-guard` **hard-blocked** deleting anything that held recorded
work — a populated item, a section with a populated item, a stage with recorded progress — forcing
the user to clear every value by hand first. The owner found this too rigid (2026-07-17): they want
to drop a whole populated section / item / stage in one move.

**New policy:** a populated delete is **allowed behind a confirmation dialog**, and because these
deletes can cascade child data (`stage_progress`, a section's items), each destructive action takes
an **auto snapshot right before deleting** so it is recoverable via S-06 restore. The two invariants
that remain:

- **Empty-sheet floor** — a kosztorys keeps **≥1 item**; deleting the last remaining item is still
  hard-blocked (`REMOVE_BLOCK_LAST_ITEM`). This is the only hard block left.
- **Recoverability is server-side** — the snapshot is captured **inside the server action, before**
  the cascade delete. A client-only snapshot would race autosave and miss the pre-delete state.

"Populated" narrowed to its only load-bearing meaning: the row/subtree holds recorded
`stage_progress`. That is the only work a delete destroys, so it is the only case that pops the
confirm dialog — a plan-only row (przedmiar / cena / rabat, no progress) deletes without a prompt.

This closes **EX-507** (unblock section delete) as a subset — the same confirm-and-snapshot flow
covers item, section, and stage.

## Coverage — every container-delete is confirm + snapshot

| Target  | Confirm dialog owner             | Server action         | Cascade                            |
| ------- | -------------------------------- | --------------------- | ---------------------------------- |
| Item    | `kosztorys-row-actions-menu.tsx` | `removeItemAction`    | (last-in-section → cascade sekcji) |
| Section | `kosztorys-section-summary.tsx`  | `removeSectionAction` | items + their `stage_progress`     |
| Stage   | `stage-header.tsx`               | `removeStageAction`   | that stage's `stage_progress`      |

Each server action fetches `investment_id`, calls `captureAutoSnapshot(...)`, then `payload.delete`.
The confirm only fires for a populated target — `planItemRemovalFromCounts` returns
`requiresConfirm` for the item path; section/stage always confirm (the summary/header dialogs).

## Files touched

- `src/lib/kosztorys/delete-policy.ts` — dropped `REMOVE_BLOCK_POPULATED` + `isSectionPopulated`;
  `planItemRemovalFromCounts` now returns a tri-state `ItemRemovalPlanT`
  (`blocked` | `cascade-section` | `remove-item`) carrying `requiresConfirm`.
- `src/lib/actions/kosztorys.ts` — removed the populated-EXISTS reject from all three delete
  actions; kept the pre-delete `captureAutoSnapshot`.
- `src/components/kosztorys/use-kosztorys-editor.ts` — `getRemovePlan` replaces
  `getRemoveBlockReason`; dropped the section populated backstop + `isSectionPopulated` export.
- `src/components/kosztorys/kosztorys-v2-column-opts.ts` + `kosztorys-v2-columns.tsx` — column opt
  carries the plan; the row-actions cell derives `removeBlockReason` + `removeNeedsConfirm`.
- `src/components/kosztorys/kosztorys-row-actions-menu.tsx` — local `ConfirmDialog` gated on
  `removeNeedsConfirm` (mirrors StageHeader / SectionSummary).
- `src/components/kosztorys/kosztorys-section-summary.tsx` + `kosztorys-editor-body.tsx` — dropped
  the populated short-circuit + `isSectionPopulated` prop; the section confirm now always shows.

## Tests

Integration specs (real DB, assert persisted state) flipped from "blocks + row survives" to
"deletes + snapshots first":

- `src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` — cases (b) item-with-progress and
  (d) section-with-progress now delete and take a snapshot.
- `src/__tests__/lib/actions/kosztorys-stages.test.ts` — stage-with-progress now deletes + snapshots.
- `src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts` — `planItemRemoval` cases carry
  `requiresConfirm`; the populated-row case is now `cascade-section` + `requiresConfirm: true`,
  not `blocked`.

**Snapshot-count gotcha:** `pruneAutoCount` caps auto snapshots at `AUTO_KEEP = 50`, so on a
saturated investment an insert+prune nets zero rows and `count(*)` can't prove a capture. The specs
assert `max(id)` **rose** instead — cap-independent, and also fixed the pre-existing `(c2)` case
that had started false-failing for the same reason.

## Not done here

- E2E (click ✕ → confirm → row/section/column gone, restore brings it back) — routed to the E2E
  backlog per the project's no-E2E-this-pass decision, not authored in this change.
