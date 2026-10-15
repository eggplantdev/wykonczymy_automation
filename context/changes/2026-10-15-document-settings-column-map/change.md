---
change_id: document-settings-column-map
title: Document settings store a column → hidden map, so a new column starts at its code default
status: implemented
created: 2026-10-15
updated: 2026-10-15
archived_at: null
branch: null
worktree: null
---

## Notes

EX-1033: investor/worker document settings store {column: hidden} map; a column missing from storage reads as its code default, so a hidden-by-default column needs no migration.

Agreed shape (2026-10-15): only the storage format changes. The sanitizers still return a resolved
`hiddenColumns: string[]`, so dialogs, print, column selection and links are untouched. Read accepts
both the legacy array and the new map; write converts the resolved list to a full map over the
ceiling. One data migration converts the 36 stored rows, run after the deploy. Same JSON column, no
schema change.
