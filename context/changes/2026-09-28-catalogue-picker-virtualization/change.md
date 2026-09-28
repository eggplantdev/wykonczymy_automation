---
change_id: catalogue-picker-virtualization
title: Virtualize the „Dodaj pracę z katalogu" picker list (EX-860)
status: implementing
created: 2026-09-28
updated: 2026-09-28
archived_at: null
branch: staging
worktree: null
---

## Notes

Linear: EX-860 (narrowed to this one dialog).

Virtualize the list in `AddItemsFromCatalogueDialog` („Dodaj pracę z katalogu"). The dialog renders
every catalogue row; the catalogue is 561 items (local DB and the 24.09 prod dump alike).

**Measured baseline** — production build, inv 157 (401 pozycji), median of 5 runs:

|                                               | now 1× | now 4× CPU           | flag-only virtualized 1× | flag-only virtualized 4× |
| --------------------------------------------- | ------ | -------------------- | ------------------------ | ------------------------ |
| open (254 of 561 rows, „Ukryj już dodane" on) | 102 ms | 412 ms (408 blocked) | 28 ms                    | 107 ms                   |
| „Ukryj już dodane" off → all 561 rows         | 167 ms | 662 ms               | 13 ms                    | 57 ms                    |
| keystroke → input shows it                    | 29 ms  | 51 ms                | 14 ms                    | 29 ms                    |
| keystroke → list repainted                    | 124 ms | 641 ms               | 23 ms                    | 68 ms                    |
| tick one checkbox                             | 23 ms  | 61 ms                | 7 ms                     | 24 ms                    |

Target: the 4–10× from the right-hand columns, **without** the layout regressions below.

**Result** — same script, build mode and investment; the MCP browser was held by another session, so
it ran in the repo's own headless Chromium (`@playwright/test`), median of 5:

|                                  | shipped 1× | shipped 4×         | vs baseline 4× |
| -------------------------------- | ---------- | ------------------ | -------------- |
| open (22 rows drawn of 254)      | 23 ms      | 91 ms (65 blocked) | 4.5× faster    |
| „Ukryj już dodane" off → all 561 | 15 ms      | 53 ms              | 12× faster     |
| keystroke → input shows it       | 17 ms      | 34 ms              | 1.5× faster    |
| keystroke → list repainted       | 28 ms      | 76 ms              | 8× faster      |
| tick one checkbox                | 12 ms      | 23 ms              | 2.7× faster    |

Every 4× figure is within 1.5× of the flag-only column. Layout at 1440: opis 354 px (widest), no
horizontal scroll, footer visible, a 2-row search collapses the list; a scroll top→bottom→top made no
jump. Real rows average 50 px (37 one-line, 57 two-line), hence the 52 px estimate. The rate columns
are 176, not 160: the nowrap „(podwykonawca)" + sort icon needs 173. Below a ~1150 px window the
table scrolls sideways — so did the unvirtualized one, whose opis alone had `min-w-112`.

**Flipping `enableVirtualization` alone breaks the layout** (screenshot-verified):

- `VirtualizedTableBody` uses `table-fixed` + a `colgroup` from `header.getSize()`; the picker columns
  (`WORK_CATALOGUE_PICKER_COLUMNS` + the select column) declare no sizes → equal widths, the select
  column as wide as „Opis pracy", the last column clipped.
- Rows wrap to ~110 px (long opis, kategoria) against the fixed `estimateSize` of 44 → needs dynamic
  row measurement (`measureElement`), or scroll position/scrollbar drift.
- `virtualContainerHeight` is a fixed px height → it overflows the „Dodaj do:" footer; the list height
  must follow the dialog (today `max-h-[55vh]`).

**Scope:** this dialog only. Dropped from EX-860: `catalogue-diff-table`, `sheet-compare-dialog` /
`sheet-report-parts`, and the EX-857 trigger. The two existing virtualized consumers
(`subcontractor-payouts-table`, `materials-transactions-table`) must not regress if the shared
`VirtualizedTableBody` changes.

Also: `src/hooks/use-search-filter.ts:30` comment claims „~950 unvirtualized rows" — stale (561), fix
alongside.

Measurement method (for re-measuring after implementation): Playwright + CDP
`Emulation.setCPUThrottlingRate`, long-task `PerformanceObserver`, rAF+setTimeout paint wait; signal
for „list updated" = text of the „Zaznacz widoczne (N)" button (a `<tr>` count cannot tell once
virtualized).
