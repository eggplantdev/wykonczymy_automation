---
change_id: kosztorys-row-height-menu
title: Row height — double-click leaves the handle, fit-to-content moves to the row menu
status: archived
created: 2026-09-14
updated: 2026-09-14
archived_at: 2026-09-14T20:48:55Z
branch: null
worktree: null
---

## Notes

Double-clicking the row handle ("fit to content") is undiscoverable — the only hint is a `title` on
an 8-pixel strip you first have to hit. Since the View menu gained the „Dopasuj wysokość wierszy"
(fit row heights) toggle (`ffee8a92`), the gesture stopped being the only way to expand a description
and remained as a trap: with the toggle on it does nothing visible, yet silently saves an override.

A bigger hole than the double-click itself: **the override can't be undone.** `resolveRowHeight` puts
a dragged height above everything, so a row flattened by dragging ignores the toggle, and no command
removes its entry from `kosztorys-v2-row-heights`.

Agreed in discussion (2026-09-14):

1. `onFit` leaves `RowResizeHandle` — the handle only drags.
2. The row menu gets „Dopasuj wysokość do treści" (fit height to content) — what the double-click did;
   deliberately clicking a named command is a deliberate pin.
3. **The command clearing the override was dropped** (owner, after implementation). It was to be
   „Przywróć domyślną wysokość" (restore default height), shown only on an overridden row — but
   "default" is not one number (52 px on the band, content with the toggle on, 32 px otherwise), so
   the label promised something other than what it did. Removing an override still has no UI path.
4. The table header (key `header`) has a handle, no row menu and no `onFit`; its override is also
   irreversible — left open. Filed as **EX-776** together with the section band and the
   `SECTION_BAND_ROW_HEIGHT` floor in `fitRowHeight()`, unreachable from the UI.

## Closing point 4 — EX-776 (2026-09-15)

Owner rulings, recorded here because the issue will be gone. The rule that orders them: **the
„Dopasuj wysokość do treści" command belongs to a row whose override permanently cuts it off from its
content — not to every row with a handle.**

- **Section band: handle + the same command in the „…" menu.** The band has content (`sectionName`),
  but single-line and overflowing sideways, not down (`.kosztorys-band-label-cell { overflow: visible }`),
  and `rowContentLines` reads only `description`/`note`, which the band lacks. So
  `fitRowHeight(bandId, 1)` always returns `SECTION_BAND_ROW_HEIGHT` = 52 — on the band this command
  **is** the way back from a drag. It also makes the `SECTION_BAND_ROW_HEIGHT` floor in
  `fitRowHeight()` reachable from the UI, so a dead-code sweep won't delete it.
- **Section footer („Razem <sekcja>"): deliberately no command.** It gets a handle (the guard in
  `ordinal-gutter-column.tsx` excludes only `SPACER_ROW_ID`/`TOTALS_ROW_ID`), and `SectionFooterCell`
  renders an empty div in „Akcje". Not the item-row trap: the footer is not a band, so its floor is
  `ITEM_ROW_HEIGHT` = 32 and `RowResizeHandle` clamps to it on preview and on commit — and the
  footer's default height is also 32. A saved override of 32 is indistinguishable from auto mode, so
  a footer drag is reversible with the bare handle. Cost: a dead entry in `kosztorys-v2-row-heights`.
- **Header row: manual only, not revisited.** No command in the „Widok" menu; the handle stays.
  `resolveHeaderRowHeight()` does carry the same `Number.isFinite` guard + `HEADER_ROW_HEIGHT` floor
  as `resolveRowHeight`.
- **The item-row label stays unchanged** — „Dopasuj wysokość do treści" there swaps one permanent
  override for another (the row still ignores the „Dopasuj wysokość wierszy" toggle, point 3 above).
  Renaming it „Wróć do automatycznej wysokości" (back to automatic height) was rejected.
- **Rejected:** wrapping the band label (a band layout change, a separate topic).

The band command surfaced two defects in `react-datasheet-grid` — both fixed in
`patches/react-datasheet-grid@4.11.6.patch` (rationale in comments inside the patch), guarded by
`src/__tests__/datasheet-grid-row-height-cache.test.ts`.
