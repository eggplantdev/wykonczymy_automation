# Kosztorys editor text size — Plan Brief

> Full plan: `context/changes/2026-10-14-kosztorys-editor-text-size/plan.md`

## What & Why

The data tables already have a font size setting („Ustal wielkość czcionki w tabeli”). The
kosztorys editor doesn't, and a long rozpiska at 14px shows few rows on screen. This adds the same
control to the editor, scaling only the font, so the layout and the „Dopasuj wysokość do treści”
mechanics stay as they are.

## Starting Point

Grid cells hard-code `text-sm` (`text-xs` on a phone) in four shared primitives. Fit-to-content
measures text with a font built from constants (14px/12px), so it would fit rows to the wrong font
the moment the cells changed size.

## Desired End State

The editor's view menu offers „Bardzo mała”, „Mała” and „Średnia”. The choice resizes item cells
and the section „Razem” row immediately, re-fits rows when „Dopasuj” is on, and is remembered per
browser for every kosztorys. Nothing outside the grid changes.

## Key Decisions Made

| Decision        | Choice                                    | Why (1 sentence)                                                                  |
| --------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| What scales     | Font only; 20px line, 32px rows, widths fixed | Smallest change. „Dopasuj” already turns a smaller font into shorter rows.       |
| Sizes           | 10 / 12 / 14px, no „Duża”                 | 14px is today's default; the request is for denser, not larger.                  |
| Reach           | Item cells + section „Razem”              | The band title and grand totals are headings; they keep their size.              |
| Memory          | One per browser, all kosztorysy           | Matches the crew axis and column order; it's a reading preference, not data.     |
| Mechanism       | CSS variable on the grid wrapper, one utility on primitives | Unset outside the grid, so `SimpleSelect` etc. can't regress.        |
| Measurement     | Read the wrapper's computed font-size     | One source of truth for cells and measurement; also fixes the ui-scale mismatch. |
| Control         | Shared radio section extracted from the tables' column menu | Same label and behaviour, no copy.                                 |
| Ellipsis        | Out                                       | Ruled out by the user.                                                            |

## Scope

**In scope:** grid cell utility + CSS, the four primitives, persisted hook, wrapper attribute,
measurement from computed style, shared menu section, editor menu entry, two specs, manual checks.

**Out of scope:** row or line-height scaling, a „Duża” size, the band title, totals, headers, the
gutter, server persistence, the clipped-text indicator.

## Architecture / Approach

`useGridTextSize()` (persisted enum) → the grid wrapper gets `data-text-size` + `grid-cell-text`
→ the CSS sets `--grid-cell-text` → each cell primitive's `grid-cell-text` reads it, falling back
to today's sizes. `useWrapColumnWidths` reads the wrapper's computed font, so a size change
produces a new `font`, which resets the row-height cache, which re-fits the rows. The view menu
calls the same hook, and the shared store keeps both in sync without context.

## Phases at a Glance

| Phase             | What it delivers                                   | Key risk                                                       |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| 1. Grid plumbing  | Cells, „Razem” and measurement follow a persisted size | Focused input: grid size on desktop vs the 16px phone floor |
| 2. Menu control   | Three-option radio in the editor's view menu       | The column-toggle file is mid-move in another session          |
| 3. Manual checks  | Registry section                                   | —                                                              |

**Prerequisites:** none. Build on the uncommitted `tables/data-table/column-toggle.tsx` move
without committing it.
**Estimated effort:** one session.

## Open Risks & Assumptions

- `typing-surface` vs `grid-cell-text` ordering in the focused input must be checked in a browser,
  not assumed from class order.
- The column-toggle move belongs to another session. If it gets reverted, phase 2's extraction
  follows the file back to `src/components/filters/`.

## Success Criteria (Summary)

- Picking „Mała” makes the rozpiska visibly denser without touching headings or totals.
- With „Dopasuj” on, rows shrink to the new text with no reload.
- The default size is pixel-identical to today.
