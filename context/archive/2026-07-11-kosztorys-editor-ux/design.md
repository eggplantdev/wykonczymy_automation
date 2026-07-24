# Kosztorys editor UX pass — design

Umbrella design for the bundle in `change.md`. The **add-position context menu** is designed to
implementation depth (it's new and load-bearing); the six existing toolbar/grid items carry a
right-altitude design note each — enough to plan from, detail settled in their own `/10x-plan`.

Shared constraint threaded through everything: the grid is `react-datasheet-grid` with `lockRows`,
and it **freezes `columns` at mount** — any change to a column definition needs a grid remount
(`key`). Several bugs below are consequences of that.

---

## 1. Add-position context menu (new)

### Goal

Google-Sheets-faithful "insert row" — right-click a grid row → insert a position above/below it,
within that row's section. Owner is a Sheets user; this is the established gesture.

### Why our own menu, not datasheet-grid's

DSG's built-in context menu (`INSERT_ROW_BELLOW` / `DELETE_ROW` / `DUPLICATE_ROW`) is disabled by
`lockRows`, and its row-create makes a **client-only row with no server id and no section** — which
does not fit our model (every item needs a server `id` + `displayOrder` + `sectionId` from an
action first). `createContextMenuComponent` only relabels the built-in items; it cannot add custom
ones. So we render our own menu.

### Interaction

- Right-click any row → menu: **Wstaw pozycję powyżej**, **Wstaw pozycję poniżej**, separator,
  **Usuń pozycję**.
- New row inherits the anchor row's `sectionId`. Insert point: above = anchor `displayOrder`;
  below = anchor `displayOrder + 1`.
- Insert items **disabled while a column sort is active** (tooltip "Najpierw zdejmij sortowanie") —
  "above/below" has no meaning against a price-sorted list. Mirrors the existing ▲▼ behavior
  (`kosztorys-v2-columns.tsx` `actionColumn`, `sortActive`).
- Delete-in-menu routes through the **existing** `handleRemoveItem` — reuses its guards (≥1 item per
  section; block a populated row) and its toasts. No new delete path.
- No "Duplikuj" (owner declined; can be added later — it's a superset of insert-below).

### Which row was clicked

Track the active cell via DSG's `onActiveCellChange({ cell: { col, row, colId } })` into a ref
(same "latest value" ref pattern already used in `use-kosztorys-editor.ts`). DSG selects the cell on
right-click before the menu opens, so at `onContextMenu` time the ref holds the target row index →
`viewRows[row]` → the anchor `KosztorysV2RowT`.

### Menu component

Lightweight, self-owned: an `onContextMenu` handler on the grid wrapper (`preventDefault`, capture
cursor `{x, y}`, read the active-cell ref, open). A small absolutely-positioned menu that closes on
outside-click / Esc / scroll. (Prefer an existing `components/ui` primitive if one fits; otherwise a
~40-line component. Radix ContextMenu is a fallback but its open trigger races the DSG cell-select,
so the explicit-handler approach is primary.)

### Server: new `insertItemAction(investmentId, sectionId, atDisplayOrder)`

```
UPDATE kosztorys_items SET display_order = display_order + 1
  WHERE section_id = $section AND display_order >= $at;      -- section-tail shift
-- then create the blank item at display_order = $at, returning { id, displayOrder }
```

- Bounded by **section** size, not the whole sheet — the 1000-row concern that made reorder a
  neighbor-swap was whole-sheet; one section is far smaller. Acceptable.
- `addItemAction` (append) stays **unchanged** for the panel `+` and new-section seeding.
- Same `protectedAction` + `['kosztorysItems']` revalidation shape as its siblings.

### Client (`use-kosztorys-editor.ts`)

`handleInsertItem(anchorRow, 'above' | 'below')`:

1. Compute `atDisplayOrder`.
2. `await insertItemAction(...)`.
3. Build the blank row via `buildBlankRow` + the section-sample denormalization already in
   `handleAddItem` (section name / coeffs / variant / vat / stages).
4. Splice into `rows` at the anchor index (±1); bump local `displayOrder` of shifted same-section
   rows so a later insert/▲▼ stays consistent with the server. Keep `prevById` in sync.

### Removed

The gated toolbar **"＋ pozycja"** button and its `activeSectionId != null` conditional render
(`kosztorys-editor-toolbar.tsx:90-94`, wiring in `kosztorys-editor-body.tsx` / hook). Panel per-section
`+` and **Nowa sekcja** stay.

### Tests

- Unit (`v2-rows.test.ts`): the splice + local displayOrder-shift helper (pure), and the
  above/below `atDisplayOrder` math.
- Browser (right-click → insert → persisted order) → **E2E backlog** (`e2e-backlog` label), owed at
  the review gate, not now.

---

## 2. EX-427 · Kosztorys/Arkusz → one toggle _(cancelled — obsolete)_

Cancelled: the Kosztorys/Arkusz tab buttons no longer exist, so there is nothing to collapse.

## 3. EX-425 · View scope buttons → toggle group _(shipped)_

The three view buttons (Klient / Z narzędziami / Bez narzędzi) collapsed into a single
`ToggleGroup` (`ui/toggle-group.tsx`, Radix ToggleGroup + a CSS sliding pill), not the originally-
proposed `Select` — dogfooding preferred a one-glance toggle over a dropdown. Same `PriceViewT`
values, same persisted `usePriceView`. The legend moved from a standalone `InfoTooltip` icon to a
`SimpleTooltip` wrapping the whole control.

## 4. EX-426 · Brutto toggle — REMOVED (superseded 2026-07-13)

Dropped instead of relabeled. Dogfooding found no rationale for ever hiding Brutto (the only
recorded reasoning — the DSG remount-key cost — argued _against_ a toggle). The additive Brutto
column + `Suma brutto` line are now **always shown**; `bruttoVisible` state, the toolbar button, and
the prop threading are gone (`gross` column is unconditional in `buildV2Columns`). EX-426 canceled.
This also eliminated one of the two §6 flicker triggers for free.

## 5. EX-421 · Toggle layout shift

Toolbar `Button variant` flips `default ⇄ outline` on toggle; if the variants differ in
border/padding the box resizes and nudges neighbors. Fix by reserving the space in both states
(transparent border / inset ring / `box-shadow` — never a border only in the active state). Applies
to every toolbar toggle and the EX-427 tab toggle. **Note:** EX-425 (→ select) and EX-426 (→ label)
remove two of the offending toggles outright, shrinking this bug's surface — sequence those first.

## 6. EX-422 · Table flicker on toggle

Root cause found: the grid's `key` includes `view` and (formerly) `bruttoVisible`, so changing
either **remounts the whole grid** → flicker. The remount exists because DSG freezes columns at
mount.

**Brutto trigger removed (2026-07-13):** the Brutto toggle is gone (§4), so `bruttoVisible` no longer
feeds the key. Residual scope is the **view-switch** remount only:

- **View** (Klient / Z narzędziami / Bez narzędzi) still changes the column set per view → still
  remounts today. Investigate whether the column _set_ actually changes per view (client vs
  subcontractor columns differ — `buildV2Columns`), or only cell rendering. If only rendering, drive
  it via `columnData` instead of a remount. Fallback: a crossfade/opacity mask so the remount doesn't
  read as a flicker.

## 7. EX-424 · Column-resize shrink floor

`kosztorys-v2-columns.tsx` `withResize` pins `minWidth = min` and the resize can't go below each
column's `minWidth`. Shrinking stops at that floor. Fix: let user-driven resize go below the design
`minWidth` (down to a small hard floor, e.g. 32px, to avoid a 0-width unhittable column), or drop
the per-column floor during an active drag. Confirm the `ResizableHeader` commit path
(`column-resize-handle`) clamps to the same floor.

## 8. EX-423 · "Wersje" drawer stuck on "Wczytywanie"

`kosztorys-versions-drawer.tsx` — the snapshot list never resolves; loading state never clears (no
error surface, permanent spinner). The drawer opens _programmatically_ (`KosztorysEditorV2` →
`versionsOpen`). Debug the fetch: does it fire on open, resolve, or throw silently? This is
**test-driven-debugging** territory — reproduce with a failing test first, then fix. May be the same
root cause tracked by EX-428/EX-419/EX-420 (S-06 restore E2E).

## 9. EX-437 · Consolidate save/version buttons into one menu

Three separate toolbar controls → one dropdown menu:

- **Zapisz jako…** — `SaveSnapshotButton` (`save-snapshot-button.tsx:35`, rendered at
  `kosztorys-editor-toolbar.tsx:100`)
- **Zapisz jako szablon** — NEW, being built on the parallel `kosztorys-preset` worktree/branch
- **Wersje** — toolbar button (`kosztorys-editor-toolbar.tsx:101-103`), opens the versions drawer

Each action keeps its behavior (dialog / drawer); only the trigger collapses to a single menu.
**Dependency:** blocked on the `kosztorys-preset` branch landing on `main` — the "Zapisz jako
szablon" entry must exist first. Coordinate so the menu absorbs that button at merge rather than
letting it ship as a fourth standalone button. "Sekcje" (a view toggle, not a save/version action)
stays separate.

---

## Sequencing (suggested)

1. **EX-425 + EX-426** first — they delete two toggles, shrinking EX-421/EX-422's surface.
2. **EX-421** (layout shift) — mechanical, on the remaining toggles + EX-427 tab toggle.
3. **EX-427** (tab toggle) — small, benefits from EX-421's fix being in.
4. **Add-position context menu** — the headline feature; independent of the toolbar work.
5. **EX-424** (resize floor) — isolated to columns.
6. **EX-422** (flicker) — needs a spike; do after the view control settles (EX-425).
7. **EX-423** (drawer) — independent bug; do any time (test-first).
8. **EX-437** (save/version menu) — **last / on merge**; blocked on the `kosztorys-preset` branch
   landing so the menu can absorb "Zapisz jako szablon".

Order is a suggestion, not a hard chain. Real couplings: EX-425/426 reduce EX-421/422; EX-437 is
blocked on the `kosztorys-preset` branch.
