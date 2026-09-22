import { Column } from 'react-datasheet-grid'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { appendTrailingGap, withResize } from '@/components/kosztorys/editor/grid/column-sizing'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import { stageGroupOfKey } from '@/lib/kosztorys/stage-keys'
import {
  baseRanksFromKeys,
  groupColumns,
  orderColumns,
  type ColumnRanksT,
} from '@/lib/table/column-order'
import {
  DISCOUNT_COLUMN_IDS,
  PREVIEW_VISIBLE_COLUMNS,
  WORKSHOP_VISIBLE_COLUMNS,
  PRZEDMIAR_ANCHORED_COLUMNS,
  UNPICKABLE_COLUMNS,
  columnLabelForView,
} from '@/lib/kosztorys/column-config'
import { LAYER_DEFAULT, layerAllows } from '@/lib/kosztorys/layer'
import { MONEY_AXIS_DEFAULT, axisAllows } from '@/lib/kosztorys/money-axis'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// A stage column answers to its axis's shared "Etapy — …" picker entry, not to its own id.
function toggleKey(columnId: string): string {
  return stageGroupOfKey(columnId) ?? columnId
}

// The column allowlist and the client price plane are one disclosure decision (useKosztorysEditor
// derives them as a pair). Split them and PREVIEW_VISIBLE_COLUMNS keeps letting `price`/`net`/`gross`
// through while they compute a subcontractor's cost basis — client-named columns holding contractor
// numbers, a leak with no foreign column to notice. Nothing in the types forbids the split, so this
// says it out loud at the one chokepoint both build paths cross. It throws rather than repairing the
// opts: a caller that got this wrong has a bug worth seeing, and silently overriding its `view` would
// hide it.
//
// What this pin does not cover: the four per-plane rate columns. They carry their plane in the id
// and assemble in EVERY view, so pinning `view` to 'client' does nothing for them — the allowlist is
// their only barrier, and it is the half to check before touching either.
function assertDisclosurePair(opts: BuildV2ColumnsOptsT): void {
  if (opts.previewVisible && opts.view !== 'client') {
    throw new Error(
      `previewVisible requires view='client' (got '${opts.view}') — the column allowlist does not pin the price plane.`,
    )
  }
}

// The preview and the workbench are ONE mechanism written twice: a fixed column list, plus no
// control on screen able to change what is read. Every gate in this file has to ask that of both, so
// it asks once here — modelled as two independent booleans, the third gate (`orderAssembled`) was
// simply forgotten and a stored column order still reshuffled the workbench. A future closed surface
// is one entry here, not three edits in three functions.
function closedColumnList(opts: BuildV2ColumnsOptsT): ReadonlySet<string> | null {
  if (opts.previewVisible) return PREVIEW_VISIBLE_COLUMNS
  if (opts.workshopVisible) return WORKSHOP_VISIBLE_COLUMNS
  return null
}

// Hide/axis/resize selection over an already-assembled column list. Split from the assembly so the
// grid and the picker can share ONE assembleV2Columns pass (buildV2Grid) instead of two.
export function selectV2Columns(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  assertDisclosurePair(opts)
  const axis = opts.moneyAxis ?? MONEY_AXIS_DEFAULT
  const layer = opts.layer ?? LAYER_DEFAULT
  // Two kinds of gate live in this filter, and only one of them may touch a client's document.
  // PREFERENCE gates — the axis, the layer, the picker tick — say what ONE owner wants to read
  // right now, so a preview skips them entirely and takes the allowlist as its
  // whole answer (owner ruling 2026-07-28). The discount gate is not one of them: `globalDiscount`
  // is a property of the investment, identical for every reader, and while it is on, the per-item
  // rabat fields are bypassed rather than cleared (calc.ts `applyDiscount`) — so showing those
  // columns would print „Rabat 10 %" beside „Kwota rabatu 0,00" on the offer itself.
  const closed = closedColumnList(opts)
  const keep = (key: string): boolean => {
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(key)) return false
    // A closed list is a ceiling AND a floor, and the workbench needs the floor for the mirror image
    // of the preview's reason: the three preference gates below persist in localStorage per BROWSER,
    // not per kosztorys, and the workbench hides every control that edits them. Honour them and it
    // renders a column set chosen on some other kosztorys, with nothing on screen able to change it
    // — „Sekcja" is in DEFAULT_HIDDEN_COLUMNS, so it would be missing from the owner's own list on a
    // first visit. The per-offer subtraction only the preview supplies still applies.
    if (closed) return closed.has(key) && !opts.previewHiddenColumns?.has(key)
    if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(key)) return false
    // The reveal sits beside UNPICKABLE_COLUMNS because it answers the same question — „may a stored
    // tick hide this right now" — and pointedly NOT beside the two gates after it: a problem filter
    // gets to overrule one owner's picker, never their money axis or layer.
    return (
      (UNPICKABLE_COLUMNS.has(key) || opts.revealedColumnIds?.has(key) || !opts.isHidden?.(key)) &&
      axisAllows(key, axis) &&
      layerAllows(key, layer)
    )
  }
  const base = assembled.filter((c) => keep(toggleKey(c.id ?? ''))).map((c) => withResize(c, opts))
  return appendTrailingGap(base, opts)
}

// Picker entries for the columns this view actually has, in grid order. Stage columns collapse into
// their axis's "Etapy — …" entry — hence the dedupe.
export function selectV2ToggleItems(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): ColumnToggleItemT[] {
  // Neither closed surface has a picker to steer — the preview mounts the slim header rather than
  // the toolbar, and the workbench's list answers the tick outright — and a picker is by definition
  // the preference selectV2Columns just stopped honouring. Empty rather than allowlist-filtered: the
  // latter would describe a grid whose columns no longer answer to it, and the toolbar hides the
  // whole button on an empty list.
  if (closedColumnList(opts)) return []
  const items: ColumnToggleItemT[] = []
  for (const col of assembled) {
    const id = toggleKey(col.id ?? '')
    if (items.some((i) => i.id === id)) continue
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(id)) continue
    if (UNPICKABLE_COLUMNS.has(id)) continue
    if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(id)) continue
    // `visible` is the STORED tick, never the reveal: a column a problem is currently forcing on
    // screen still reports what the picker holds. Unticking it then is a no-op that takes effect on
    // disengage — accepted, because showing it ticked would lie about what is saved and disabling it
    // would need a third state nobody asked for.
    items.push({ id, label: columnLabelForView(id, opts.view), visible: !opts.isHidden?.(id) })
  }
  return items
}

// The owner's stored column order, applied to the assembled list — BEFORE the filter, since the
// filter preserves relative order: one sort then serves both the grid and the picker, and the
// trailing gap (appended post-filter) stays last.
//
// A closed surface skips it whole, for the reason `keep` states: the rank map is one browser's
// reading preference, exactly like the axis, the layer and the picker tick, and the only UI that
// edits or resets it lives in KosztorysViewMenu. On a preview that would let a client's own
// localStorage — client-writable — reshape what they are served (ruling 2026-07-28); in the
// workbench, six columns would arrive in an order the owner cannot see the origin of, let alone
// change.
export function orderAssembled(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  // An empty rank map is the assemble order by definition, and it is what every owner who never
  // reordered anything has — bail before the group→sort→regroup pass instead of reproducing the
  // input array on each render.
  if (closedColumnList(opts) || !opts.columnRanks || Object.keys(opts.columnRanks).length === 0) {
    return assembled
  }
  return orderColumns(assembled, opts.columnRanks, toggleKey)
}

// Assemble-order rank per group key: the fallback an unranked column sorts at. Read off the list
// BEFORE ordering — the reorder dialog only ever sees the already-ordered picker list, so it cannot
// derive this itself.
export function assembleBaseRanks(assembled: Column<KosztorysV2RowT>[]): ColumnRanksT {
  return baseRanksFromKeys([...groupColumns(assembled, toggleKey).keys()])
}
