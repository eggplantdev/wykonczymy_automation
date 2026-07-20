---
change_id: kosztorys-note-cell-overlay
title: Read and edit long Komentarz notes via an in-cell overlay textarea
status: planned
created: 2026-07-19
updated: 2026-07-19
archived_at: null
branch: null
worktree: null
---

## Notes

Linear: EX-538 — https://linear.app/ex-plant/issue/EX-538

Long „komentarz" text is unreadable in the grid — `textColumn` renders a single-line input in a
32px row, so anything past ~30 chars clips with no way to see it.

Shaped 2026-07-19. Chosen approach: a custom cell that stays a truncated one-liner when inactive and,
on focus, renders a `<textarea>` absolutely positioned over the cell (min-w ~360px, ~7rem tall,
elevated z-index) — the Google Sheets behaviour. Rejected: Radix Popover (portal + focus trap fights
DSG's keyboard model) and a detail strip below the toolbar (permanent vertical chrome, eyes leave the
row).

Hover-to-read on inactive cells was explicitly deferred — owner wants an eyeball test on the overlay
alone first, then decides whether scanning still hurts.
