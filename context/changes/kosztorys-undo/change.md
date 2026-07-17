---
change_id: kosztorys-undo
title: Kosztorys in-session undo / redo (re-integration onto staging)
status: implementing
created: 2026-07-17
updated: 2026-07-17
archived_at: null
branch: kosztorys-undo
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/kosztorys-undo
---

## Notes

Fast **in-session** undo/redo of recent editor edits — cell edit, stage-progress edit, ▲▼ reorder,
and the out-of-grid panel edits (section rename, per-investment VAT, subcontractor coefficients) —
via toolbar buttons **and** Cmd+Z / Cmd+Shift+Z, so spreadsheet-parity includes instantly reversing a
fat-finger without reaching for a snapshot. The stack lives in the browser tab and is gone on reload;
durable recovery is S-06 snapshots' job.

### Why this is a re-integration, not a fresh build

The slice was fully implemented on the unmerged `feat/kosztorys-undo` branch (engine + commands +
S-06 gate + coalescing, 30 unit tests, 14 manual checks passed). That branch was cut from a
~200-commit-stale base, and `staging` has since heavily refactored the exact integration surface
(EX-515 split `use-kosztorys-editor.ts`, +366/−139). A `git merge`/`rebase` would be a manual
re-weave over conflicts, so instead: **port the self-contained engine files verbatim, re-implement
the ~249-line editor integration against staging's current handlers.** Every seam the integration
hooks into still exists on staging by name (verified 2026-07-17). Source of the salvaged code:
`feat/kosztorys-undo` (last commit `8e4eb7c`).

### Decisions

- **Scope A (owner, 2026-07-12, reconfirmed 2026-07-17):** simple undo/redo only. **No** add/delete
  undo, **no** `uid` identity map, **no** cascade (section/stage delete) undo. The S-08 delete-guard
  means only _empty_ rows/sections/stages can be deleted, so add/delete-undo reconstructs nothing of
  value; cascade recovery already belongs to S-06 (delete actions force a pre-delete snapshot).
- **Coverage:** in-grid cell edits + stage-progress + reorder **and** the panel-driven field edits
  (rename / VAT / coeff). Broader than the roadmap's listed set — owner call.
- **Cmd+Z coexistence — layered handoff (owner, 2026-07-17):** global Cmd+Z drives our stack
  **except while a cell/input is in active text-edit**, where react-datasheet-grid's native character
  undo wins. This is the branch's already-verified approach (passed manual checks). The boundary —
  native-undoing a value that already coalesced into our stack — is the sharp edge; the deferred E2E
  is where it gets pinned.
- **Granularity:** one committed change = one undo step; a multi-cell paste / per-keystroke
  `onChange` burst (dsg `continuousUpdates:true`) collapses into a single undo entry via burst
  coalescing (`UNDO_COALESCE_MS` = 700ms).
- **S-06 follow-up folded in:** gate S-06's unconditional 10-min auto-snapshot interval on this
  stack's `revision` (dirty flag) so an idle editor stops writing identical snapshots.
- **E2E deferred (owner, 2026-07-17):** the owed browser E2E ships as an `e2e-backlog` Linear issue
  (**EX-525**), not in this plan. S-07 lands **in-review**, not Done, until it's authored.

## Future seam (NOT this slice)

- **Identity map + delete-undo:** deferred. Mint points would be `treeToRows` + `buildBlankRow`;
  `prevById` generalises to `Map<uid, dbId>`. Only worth it if a future decision makes a
  _populated_-row delete Cmd+Z-reversible (not recommended — keep heavyweight deletes on the snapshot
  path).
- **Populated-delete confirm dialog:** already shipped separately (EX-477, `kosztorys-delete-confirm`
  — confirm-then-snapshot). Not undoable via this stack.

Plan: `plan.md` · Brief: `plan-brief.md`.
