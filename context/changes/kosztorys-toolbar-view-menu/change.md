---
change_id: kosztorys-toolbar-view-menu
title: Consolidate kosztorys editor toolbar toggles into one "Widok" popover
status: implemented
created: 2026-07-16
updated: 2026-07-16
archived_at: null
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

Sits on top of the shipped `kosztorys-layer-toggle` slice. The v2 editor toolbar grew to
four segmented toggles + a Kolumny picker — the owner reports it as unreadable ("za dużo
przełączników"). Collapse it into **one `Widok` popover**, keeping only the `Widok cen`
toggle out on the toolbar (most-flipped lens).

Design brief: `design.md` in this folder.

## Epilogue

Implemented in two phases (`31b3e49` mapper + unit test, `a74abd7` menu + toolbar rewire), then a
dogfooding follow-up. Toolbar went from five reading controls to two: `Widok cen` stays out,
everything else folds into one grouped `Widok` popover.

Dogfooding follow-up (owner-driven): the min-1 guard was removed, so each axis (Kwoty / Warstwy /
Etapy) now carries a fourth `none` state — both boxes unchecked hides that axis' columns, an empty
table being a legitimate view. Etapy moved from a single-select radio to a checkbox pair (PLN /
Procent); sections were reordered to Kwoty → Warstwy → Etapy → Kolumny; section tooltips were
stripped to Kolumny only; Kolumny gained a „Pokaż wszystkie" action. The pairs are a skin over the
existing persisted hooks via the four-state mapper in `src/lib/kosztorys/axis-checkboxes.ts`; the
localStorage `VALID_*` arrays gained `none`. No new storage key, no migration.

Manual dogfooding gate: `context/foundation/manual-checks.md` → `## kosztorys-toolbar-view-menu`
(8 boxes, pending first pass — hard blocker before this is `Done`).
