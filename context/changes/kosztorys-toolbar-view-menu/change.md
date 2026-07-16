---
change_id: kosztorys-toolbar-view-menu
title: Consolidate kosztorys editor toolbar toggles into one "Widok" popover
status: planned
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
