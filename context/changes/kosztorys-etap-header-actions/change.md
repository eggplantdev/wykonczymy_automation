---
change_id: kosztorys-etap-header-actions
title: Make the kosztorys etap column header actionable — rename + guarded delete
status: preparing
created: 2026-07-16
updated: 2026-07-16
archived_at: null
branch: null
worktree: null
---

## Notes

Make the etap (stage) column header functional in the kosztorys v2 editor: restore working rename and
add a destructive delete guarded by a confirmation dialog.

The header is wired in source (`columnOpts` → `buildV2Columns` → `StageHeader` with
`onRename`/`onRemove`) yet inert live inside the reactive `DynamicDataSheetGrid` — the input's
`onBlur` rename and the ✕ button's `onClick` don't fire. Root-causing the dead-header interactivity
is the first research task; the finding dictates the fix seam (stop-propagation on the header node, a
header portal, or relocating the affordance) — do not pre-commit the mechanism before the repro.

Delete UX (approved, owner 2026-07-16): ✕ opens a confirmation dialog reusing the `pendingRemove`
pattern from `kosztorys-section-summary.tsx`, then calls the existing `removeStageAction` — which
already has a recorded-postęp guard (blocks + toasts „Najpierw wyczyść ilości wpisane w tym etapie")
and a forced pre-delete auto-snapshot. No server or migration change.

Regression guard is browser-level (the bug lives in DOM event flow, unreachable by unit tests) →
Playwright E2E, routed to /10x-e2e: open editor → ✕ etap → confirm → column gone; rename persists
across reload.

Out of scope: whether seeding from a szablon should carry the szablon's etapy — owned by a separate
agent.
