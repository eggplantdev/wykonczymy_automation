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

## 2. EX-427 · Kosztorys/Arkusz → one toggle

`kosztorys-tab-host.tsx:24-40` — two `Button`s. Collapse to a single toggle that flips
`kosztorys ⇄ arkusz` and shows the current view. Behavior/views unchanged. Watch the same layout-shift
trap as EX-421 (see below) — the toggle must not resize on state change.

## 3. EX-425 · View scope buttons → select

`kosztorys-editor-toolbar.tsx:10,64-73` — the three view buttons (Klient / Z narzędziami / Bez
narzędzi) are mutually exclusive; replace with a shadcn `Select`. Same `PriceViewT` values, same
persisted `usePriceView`. Frees horizontal space and sidesteps the toggle layout/flicker issues.
Keep the `InfoTooltip` legend.

## 4. EX-426 · Brutto toggle: label + tooltip (option A)

Keep the **additive** Brutto behavior (`bruttoVisible` adds a column + Suma brutto line; netto always
shown). Fixes: (a) the button label always reflects state (e.g. checkbox-style / "Brutto: wł/wył")
so it's never a guess; (b) add a tooltip explaining it shows the gross column (netto × (1 + VAT)).
No mode-switch. (The existing `title` at `kosztorys-editor-toolbar.tsx:80` is a start; make the
state legible in the label itself.)

## 5. EX-421 · Toggle layout shift

Toolbar `Button variant` flips `default ⇄ outline` on toggle; if the variants differ in
border/padding the box resizes and nudges neighbors. Fix by reserving the space in both states
(transparent border / inset ring / `box-shadow` — never a border only in the active state). Applies
to every toolbar toggle and the EX-427 tab toggle. **Note:** EX-425 (→ select) and EX-426 (→ label)
remove two of the offending toggles outright, shrinking this bug's surface — sequence those first.

## 6. EX-422 · Table flicker on toggle

Root cause found: the grid's `key` includes `view` and `bruttoVisible`
(`kosztorys-editor-body.tsx:96`), so toggling either **remounts the whole grid** → flicker. The
remount exists because DSG freezes columns at mount. Options, cheapest first:

- **View** becomes a `Select` (EX-425) but still needs the column set to change → still needs a
  remount today. Investigate whether the column _set_ actually changes per view (client vs
  subcontractor columns differ — `buildV2Columns`), or only cell rendering. If only rendering, drive
  it via `columnData` instead of a remount.
- **Brutto** adds/removes one column. A full remount for one column is the heavy part — explore
  keeping the Brutto column always mounted but width-collapsed / hidden via `columnData`, so the
  toggle is a cheap re-render.
  This one needs a spike in its own plan; don't hand-wave the fix. If a clean decouple isn't cheap,
  the fallback is a crossfade/opacity mask so the remount doesn't read as a flicker.

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

---

## Sequencing (suggested)

1. **EX-425 + EX-426** first — they delete two toggles, shrinking EX-421/EX-422's surface.
2. **EX-421** (layout shift) — mechanical, on the remaining toggles + EX-427 tab toggle.
3. **EX-427** (tab toggle) — small, benefits from EX-421's fix being in.
4. **Add-position context menu** — the headline feature; independent of the toolbar work.
5. **EX-424** (resize floor) — isolated to columns.
6. **EX-422** (flicker) — needs a spike; do after the view control settles (EX-425).
7. **EX-423** (drawer) — independent bug; do any time (test-first).

Order is a suggestion, not a hard chain — the only real coupling is EX-425/426 reducing EX-421/422.
