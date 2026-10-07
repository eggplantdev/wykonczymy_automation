---
change_id: kosztorys-fit-all-columns
title: Fit row height measures every text column, with an exclusion list
status: implemented
created: 2026-10-07
updated: 2026-10-07
archived_at: null
branch: null
worktree: null
---

## Notes

„Dopasuj wysokość do treści" (and the clip „…" cue) measure every text column by default, with an
explicit exclusion list instead of the hand-kept `WRAPPING_COLUMN_IDS` allowlist
(`src/lib/kosztorys/row-content-lines.ts`).

Trigger: Komentarz do pracy was never measured — a new column silently missed the allowlist. The
interim fix (workNote on the allowlist + katalog lookup + CSS cue + spec) landed in `1002b5688`.

Open points for the plan:

- A column's text source: most columns expose `copyValue`, but not all (Komentarz do pracy reads
  the katalog entry, not the row) — a generic per-column text getter is needed.
- Widths: `useWrapColumnWidths` finds header cells by a per-id class — every column needs one,
  assigned centrally (the `gridColumns` map in `kosztorys-editor-body.tsx`).
- Clip cue: `globals.css` hand-writes one selector pair per id; with all columns measured it has to
  become generic (e.g. a per-cell class instead of row × cell intersection) — mind EX-496 render
  churn and the `rowHeights` dependency.
- Edits to a measured text (opis, komentarz) don't reset dsg's row-height cache in „fit all rows"
  mode — decide whether that belongs here.

## As built (2026-10-07)

- `measuredColumns` (`src/lib/kosztorys/row-content-lines.ts`) reads every column's text through its
  own `copyValue`; `UNMEASURED_COLUMN_IDS` excludes columns that copy a code rather than the label
  they show (`reviewStatus`, `discountType`, `priceMode__*`). „Komentarz do pracy" got a `copyValue`
  off the katalog entry, so the interim `workNotes` plumbing is gone.
- Every column's header gets `wrapColumnClass(id)` centrally (`gridColumns` in the editor body); the
  per-factory classes are removed.
- The clip „…" is one grid-level `cellClassName` (`kosztorys-clipped`) and one CSS rule, cached per
  row object — no per-id selector pairs left to forget.
- Not done: resetting dsg's height cache after an edit to a measured text in „fit all rows" mode.
