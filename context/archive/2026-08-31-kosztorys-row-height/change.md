---
change_id: kosztorys-row-height
title: Kosztorys row height — patch for the library's cache, owner drags rows, client view fits content
status: archived
created: 2026-08-31
updated: 2026-09-02
archived_at: 2026-09-02T08:05:52Z
branch: null
worktree: null
---

## Notes

EX-699. The first thing the owner and workers asked for after launch: „Opis prac" is clipped to one
line and can't be read in full. The client in the offer preview must see whole work names too — today
only by clicking cell by cell.

Three steps: patch `react-datasheet-grid@4.11.6` (`patches/`; the latest release, no upstream fix
coming — `useRowHeights` caches heights and offsets in a `useRef` and never clears them), row-edge
drag in the editor, and content-fitted height in the client preview (recomputed on column resize —
the client may drag columns, deliberately). Wrapping and row height are one change, not two: cells
don't clip overflow, so wrapped text in a short row spills onto its neighbours.

## Owner rulings (2026-08-31)

- **No single height for all rows** — the longest description would dictate it for one-word rows
  too. No "low/medium/high" picker on the toolbar either.
- **No height cap** (owner). A very long description makes a very tall row, and that's fine — it is
  on whoever typed it.
- **Editor: height set by hand, by dragging the row edge.** Fit-to-content alone in the editor was
  rejected — the owner doesn't always want descriptions expanded, and a grid where columns drag but
  rows don't is unintuitive. Double-click on the edge = fit to content.
- **Overrides stored in the browser, sparse**, like column widths: only a dragged row gets an entry.
- **Client preview: height from content**, no drag — the client has nothing to steer with, and the
  owner's overrides never reach him (they're local).
- **Section band and header row draggable too** (owner reported their absence); only the spacer and
  „Razem" stay handle-less — fillers, not content.
- **Text vertically centred in the cell** (owner: "the text must be centred in the cell").

> **Superseded (after archive):** the editor gained a „Dopasuj wysokość wierszy" toggle in Opcje
> (`ffee8a92`, `use-fit-rows-to-content.ts`); wrapping is measured only for `sectionName` /
> `description` / `note` (`row-content-lines.ts`), not every text column; a clipped cell also shows
> a „…" in its corner (`globals.css`); the header rests at 84 px, not 56
> (`row-height.ts`); text measuring lives in `src/lib/utils` (`40f74b88`).

## Verified on real data (2026-08-31)

**Section-band defect CONFIRMED — an offset, not a random wrong height.** Inserting a section at the
top of investment 106's kosztorys without a reload drew the „Prace dodatkowe" band at 32 px instead
of 52 and the next ordinary item at 52 instead of 32: heights were served from pre-insert indices,
shifted by the number of inserted rows. It was live on production and unrelated to wrapping — the
patch is what fixes it.

**Canvas wrap measurement matched the browser in 118 of 120 cells.** Both misses were texts sitting
exactly on the column-width boundary — sub-pixel rounding. **Measure with 1 px slack:** erring tall
costs a strip of blank space; erring short clips text, breaking exactly what this fixes.

**Section-band labels are excluded from measurement** — the label sits in a narrow cell and
deliberately spills into its neighbours; measuring it at its own width would make a three-line band
for no reason.

**Real data is milder than the plan assumed** (4000 local items): longest description 274 chars
(~4–5 lines), mean ~44; zero hard newlines (the algorithm still handles them — the field allows
them); largest kosztorys 379 items, not 1000 (1000 remains only in the synthetic set).
