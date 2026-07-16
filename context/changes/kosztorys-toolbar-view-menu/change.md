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

Implemented in two phases (`31b3e49` mapper + unit test, `a74abd7` menu + toolbar rewire).
Toolbar went from five reading controls to two: `Widok cen` stays out, everything else folds into
one grouped `Widok` popover. No persisted state changed — the Kwoty/Warstwy checkbox pairs are a
skin over the existing tri-state hooks via the min-1-guarded mapper in `src/lib/kosztorys/axis-checkboxes.ts`.

Manual dogfooding gate: `context/foundation/manual-checks.md` → `## kosztorys-toolbar-view-menu`
(6 boxes, pending first pass — hard blocker before this is `Done`).
