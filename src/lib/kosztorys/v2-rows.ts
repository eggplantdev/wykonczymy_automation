import {
  isGlobalDiscountActive,
  netForQtyForView,
  rowPlannedNetForView,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { DEFAULT_ITEM_DESCRIPTION, DEFAULT_UNIT, STAGE_QTY_PREFIX } from '@/lib/kosztorys/constants'
import type {
  CostVariantT,
  ItemPatchT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
  SectionSubtotalT,
  StageKeyT,
} from '@/types/kosztorys'

export function stageKey(stageId: number): StageKeyT {
  return `${STAGE_QTY_PREFIX}${stageId}`
}

// Client mirror of the server delete-guard predicate (removeItemAction/removeSectionAction).
// A row is "populated" iff it holds recorded stage progress (qty <> 0) — that is the only work a
// delete would destroy. Server SQL stays the authority; this only drives the pre-check + toast so a
// populated delete never optimistically vanishes. Field names must match the server predicate.
export function isRowPopulated(row: KosztorysV2RowT, stages: KosztorysStageT[]): boolean {
  return stages.some((st) => (row[stageKey(st.id)] ?? 0) !== 0)
}

export function isSectionPopulated(
  rows: KosztorysV2RowT[],
  sectionId: number,
  stages: KosztorysStageT[],
): boolean {
  return rows.some((r) => r.sectionId === sectionId && isRowPopulated(r, stages))
}

// Item fields editable in the grid (= the keys of ItemPatchT). The diff compares only these.
const ITEM_FIELDS = [
  'description',
  'unit',
  'plannedQty',
  'discountType',
  'discountValue',
  'clientPrice',
  'wToolsOverrideType',
  'wToolsOverrideValue',
  'ownToolsOverrideType',
  'ownToolsOverrideValue',
  'costVariant',
  'hiddenInExport',
  'note',
] as const satisfies readonly (keyof ItemPatchT)[]

export function treeToRows(tree: KosztorysTreeT): KosztorysV2RowT[] {
  const progressByItem = new Map<number, Record<number, number>>()
  for (const p of tree.progress) {
    const m = progressByItem.get(p.itemId) ?? {}
    m[p.stageId] = p.qtyDone
    progressByItem.set(p.itemId, m)
  }

  const globalDiscountActive = isGlobalDiscountActive(tree.globalDiscount)

  const rows: KosztorysV2RowT[] = []
  for (const section of tree.sections) {
    for (const item of section.items) {
      const qty = progressByItem.get(item.id) ?? {}
      const stageFields: Record<string, number> = {}
      for (const st of tree.stages) stageFields[stageKey(st.id)] = qty[st.id] ?? 0
      rows.push({
        ...item,
        sectionName: section.name,
        vatRate: tree.vatRate,
        globalDiscountActive,
        sectionDefaultCostVariant: section.defaultCostVariant,
        sectionWToolsCoeff: section.wToolsCoeff,
        sectionOwnToolsCoeff: section.ownToolsCoeff,
        globalWToolsCoeff: tree.globalCoeffs.wTools,
        globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
        ...stageFields,
      } as KosztorysV2RowT)
    }
  }
  return rows
}

export type RowDiffT = {
  itemPatch?: ItemPatchT
  stageChanges?: { stageId: number; qty: number }[]
}

export function diffRow(prev: KosztorysV2RowT, next: KosztorysV2RowT): RowDiffT {
  const itemPatch: Record<string, unknown> = {}
  for (const f of ITEM_FIELDS) {
    if (prev[f] !== next[f]) itemPatch[f] = next[f]
  }

  const stageChanges: { stageId: number; qty: number }[] = []
  for (const k of Object.keys(next)) {
    if (!k.startsWith(STAGE_QTY_PREFIX)) continue
    const nextVal = next[k as StageKeyT]
    if (prev[k as StageKeyT] !== nextVal) {
      stageChanges.push({
        stageId: Number(k.slice(STAGE_QTY_PREFIX.length)),
        qty: Number(nextVal) || 0,
      })
    }
  }

  const diff: RowDiffT = {}
  if (Object.keys(itemPatch).length > 0) diff.itemPatch = itemPatch as ItemPatchT
  if (stageChanges.length > 0) diff.stageChanges = stageChanges
  return diff
}

// Toolbar filter: search over description / section / unit (parity with v1). Empty/whitespace → no filter.
export function filterRows(rows: KosztorysV2RowT[], query: string): KosztorysV2RowT[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (r) =>
      (r.description ?? '').toLowerCase().includes(q) ||
      r.sectionName.toLowerCase().includes(q) ||
      (r.unit ?? '').toLowerCase().includes(q),
  )
}

export type SortDirT = 'asc' | 'desc'

// Sort by the accessor's value; strings by locale (pl), numbers numerically. Returns a new array.
// Decorate-sort-undecorate: getValue can be an O(stages) reduce (the "remaining" key), and calling
// it inside the comparator would re-evaluate it ~2·n·log(n) times — compute it once per row instead.
//
// A null key renders as "—" (fmtOrDash), so it has no place in the order: sorted numerically it
// would land as 0 and the dash would masquerade as a settled row. Nulls sink to the bottom under
// BOTH directions — `sign` deliberately does not touch that branch, or "desc" would float them up.
export function sortRows(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): KosztorysV2RowT[] {
  const sign = dir === 'asc' ? 1 : -1
  const decorated = rows.map((row) => ({ row, key: getValue(row) }))
  decorated.sort((a, b) => {
    if (a.key == null || b.key == null) {
      if (a.key == null && b.key == null) return 0
      return a.key == null ? 1 : -1
    }
    if (typeof a.key === 'string' || typeof b.key === 'string') {
      return sign * String(a.key).localeCompare(String(b.key), 'pl')
    }
    return sign * (a.key - b.key)
  })
  return decorated.map((d) => d.row)
}

// Revert a row field to its pre-edit value (revert-on-error autosave), but ONLY
// if nothing newer was typed since the failed save (current === attempted) —
// otherwise we would trample the user's fresher edit.
export function revertField(
  rows: KosztorysV2RowT[],
  id: number,
  field: keyof KosztorysV2RowT,
  prevValue: unknown,
  attempted: unknown,
): KosztorysV2RowT[] {
  return rows.map((r) => {
    if (r.id !== id || r[field] !== attempted) return r
    return { ...r, [field]: prevValue } as KosztorysV2RowT
  })
}

export type BlankRowInputT = {
  id: number
  displayOrder: number
  sectionId: number
  sectionName: string
  vatRate: number
  globalDiscountActive: boolean
  sectionDefaultCostVariant: CostVariantT
  sectionWToolsCoeff: number | null
  sectionOwnToolsCoeff: number | null
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
  stages: KosztorysStageT[]
}

// Blank item row = addItemAction's server defaults + denormalized section fields
// + stage_*=0. Built optimistically from the known id/displayOrder returned by the action.
export function buildBlankRow(input: BlankRowInputT): KosztorysV2RowT {
  const stageFields: Record<string, number> = {}
  for (const st of input.stages) stageFields[stageKey(st.id)] = 0
  return {
    id: input.id,
    sectionId: input.sectionId,
    displayOrder: input.displayOrder,
    description: DEFAULT_ITEM_DESCRIPTION,
    unit: DEFAULT_UNIT,
    plannedQty: 0,
    discountType: null,
    discountValue: 0,
    clientPrice: 0,
    wToolsOverrideType: null,
    wToolsOverrideValue: 0,
    ownToolsOverrideType: null,
    ownToolsOverrideValue: 0,
    costVariant: null,
    hiddenInExport: false,
    note: null,
    sectionName: input.sectionName,
    vatRate: input.vatRate,
    globalDiscountActive: input.globalDiscountActive,
    sectionDefaultCostVariant: input.sectionDefaultCostVariant,
    sectionWToolsCoeff: input.sectionWToolsCoeff,
    sectionOwnToolsCoeff: input.sectionOwnToolsCoeff,
    globalWToolsCoeff: input.globalWToolsCoeff,
    globalOwnToolsCoeff: input.globalOwnToolsCoeff,
    ...stageFields,
  } as KosztorysV2RowT
}

export function applyAddItem(rows: KosztorysV2RowT[], row: KosztorysV2RowT): KosztorysV2RowT[] {
  return [...rows, row]
}

export function applyRemoveItem(rows: KosztorysV2RowT[], itemId: number): KosztorysV2RowT[] {
  return rows.filter((r) => r.id !== itemId)
}

// display_order the inserted row takes: "above" claims the anchor's slot, "below" the next one.
// Mirrors insertItemAction's server-side insert point.
export function insertDisplayOrder(anchor: KosztorysV2RowT, dir: 'above' | 'below'): number {
  return dir === 'above' ? anchor.displayOrder : anchor.displayOrder + 1
}

// Splice a blank row into the display sequence at the anchor (±1) and bump the local display_order
// of same-section rows at/after the insert point — the client mirror of insertItemAction's
// section-tail shift, so a later ▲▼/insert stays consistent with the server without a refresh.
// Array position (not display_order) drives the unsorted grid render, so the row lands at the
// anchor's array index; the display_order bump only keeps the persisted-order mirror correct.
// `newRow.displayOrder` MUST be the insert point (from insertDisplayOrder) before calling.
export function applyInsertItem(
  rows: KosztorysV2RowT[],
  anchorId: number,
  newRow: KosztorysV2RowT,
  dir: 'above' | 'below',
): KosztorysV2RowT[] {
  const anchorIdx = rows.findIndex((r) => r.id === anchorId)
  if (anchorIdx < 0) return rows
  const at = newRow.displayOrder
  const bumped = rows.map((r) =>
    r.sectionId === newRow.sectionId && r.displayOrder >= at
      ? { ...r, displayOrder: r.displayOrder + 1 }
      : r,
  )
  const insertIdx = dir === 'above' ? anchorIdx : anchorIdx + 1
  return [...bumped.slice(0, insertIdx), newRow, ...bumped.slice(insertIdx)]
}

// Count of a section's items in the full dataset — guards the invariant "a section has ≥1 item".
export function sectionItemCount(rows: KosztorysV2RowT[], sectionId: number): number {
  return rows.reduce((n, r) => (r.sectionId === sectionId ? n + 1 : n), 0)
}

export const REMOVE_BLOCK_LAST_ITEM = 'Kosztorys musi mieć co najmniej jedną pozycję'
export const REMOVE_BLOCK_POPULATED = 'Najpierw wyczyść wartości wpisane w tej pozycji'

export type ItemRemovalPlanT =
  | { kind: 'blocked'; reason: string }
  | { kind: 'cascade-section' }
  | { kind: 'remove-item' }

// What deleting `row` does, given the whole sheet `rows` + `stages`. Pure so the disabled-tooltip
// reason and the delete handler share one source of truth (use-kosztorys-editor).
export function planItemRemoval(
  rows: KosztorysV2RowT[],
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
): ItemRemovalPlanT {
  // Floor: keep ≥1 item in the whole sheet so the editor never goes fully empty. Checked before the
  // populated guard — the final row stays blocked even once its values are cleared.
  if (rows.length <= 1) return { kind: 'blocked', reason: REMOVE_BLOCK_LAST_ITEM }
  // A populated row would optimistically vanish then reappear; the server guard stays the authority.
  if (isRowPopulated(row, stages)) return { kind: 'blocked', reason: REMOVE_BLOCK_POPULATED }
  // Last item in its section → cascade-delete the section so no orphaned 0-row section is left.
  if (sectionItemCount(rows, row.sectionId) <= 1) return { kind: 'cascade-section' }
  return { kind: 'remove-item' }
}

// Move an item one place within ITS section (▲/▼). Operates on the display sequence
// of items in the same section (their order in `rows`), NOT on block contiguity —
// this way it tolerates an item appended to the end of `rows` by applyAddItem (Slice 1).
// Returns the same reference on a no-op (block edge / unknown id) — a signal to the editor
// that there is nothing to save.
export function swapItemInSection(
  rows: KosztorysV2RowT[],
  itemId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT[] {
  const target = rows.find((r) => r.id === itemId)
  if (!target) return rows
  // Indices in `rows` of items in the same section, in array order (= display order).
  const sameSection = rows
    .map((r, i) => ({ id: r.id, i }))
    .filter((_, idx) => rows[idx].sectionId === target.sectionId)
  const pos = sameSection.findIndex((x) => x.id === itemId)
  const targetPos = dir === 'up' ? pos - 1 : pos + 1
  if (targetPos < 0 || targetPos >= sameSection.length) return rows // block edge → no-op
  const a = sameSection[pos].i
  const b = sameSection[targetPos].i
  const next = [...rows]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

// Neighbor of an item within ITS section in the ▲/▼ direction (same sequence as swapItemInSection).
// `undefined` at the block edge — a no-op signal. Used to swap the display_order of two rows.
export function sectionNeighbor(
  rows: KosztorysV2RowT[],
  itemId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT | undefined {
  const target = rows.find((r) => r.id === itemId)
  if (!target) return undefined
  const sameSection = rows.filter((r) => r.sectionId === target.sectionId)
  const pos = sameSection.findIndex((r) => r.id === itemId)
  const neighborPos = dir === 'up' ? pos - 1 : pos + 1
  return sameSection[neighborPos]
}

/** The "Pomiar z natury" itself — the sheet's O = SUM(D:M), not a stored field (EX-494). */
export function rowTotalQtyDone(row: KosztorysV2RowT, stages: KosztorysStageT[]): number {
  return stages.reduce((sum, st) => sum + (row[stageKey(st.id)] ?? 0), 0)
}

/**
 * The row's settlement value at the view's price — the sheet's T: what has actually been executed.
 *
 * There is no choice of quantity to make here (EX-494): the pomiar IS the stage sum, so a branch
 * "pomiar or stages?" would be picking between a number and itself. This is the reason the
 * settlement layer lives here and not in calc.ts — the quantity comes from the stages, and calc.ts
 * is the pricing layer, structurally stage-blind. It owns the price beneath this; we own the
 * quantity above it.
 *
 * Straight from the primitive rather than Σ stageValueForView: the shares sum to 1, so the reduce
 * would buy the same figure at O(stages) and a rounding error.
 */
export function rowValueForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return netForQtyForView(row, rowTotalQtyDone(row, stages), view)
}

/**
 * How much of the OFFER is left: the przedmiar's value minus what the stages have executed.
 *
 * This is where we knowingly break parity with the sheet. Its AF anchors on T — the executed value —
 * and since O IS the stage sum, AF = T − Σ(V:AE) is identically zero: a dead column. Anchored on S
 * instead, the figure says something ("how much of the offer is left") and can go negative, which is
 * also information: more was executed than was offered.
 *
 * `null`, not 0, when there is no przedmiar — 0 would claim the row is settled. The guard is `> 0`
 * rather than `=== 0` because a cleared cell writes null, which strict equality walks past.
 */
export function rowRemainingForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number | null {
  if (!(row.plannedQty > 0)) return null
  return rowPlannedNetForView(row, view) - rowValueForView(row, stages, view)
}

/**
 * Was more executed than was offered? Drives the row's red highlight.
 *
 * Deliberately NOT "przedmiar ≠ Σ etapów": a half-finished row is normal work in progress, and
 * flagging it would paint the whole grid red on a healthy kosztorys. Work recorded against no
 * przedmiar at all is not a separate branch — it is the przedmiar-is-0 case, which every stage
 * overshoots.
 */
export function hasStagesOverPlanned(row: KosztorysV2RowT, stages: KosztorysStageT[]): boolean {
  return rowTotalQtyDone(row, stages) > (row.plannedQty ?? 0)
}

/**
 * Subtotals per section for the active price view, over the full dataset (ignores filter/sort).
 * Order = first occurrence of each section in `rows` (treeToRows already yields section→displayOrder).
 *
 * Carries BOTH figures, the way the sheet's footer keeps S456 and T456 side by side: `plannedNet` is
 * what was offered, `net` what has been executed. Nothing has to choose between them, and the
 * progress counter divides one by the other.
 */
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): SectionSubtotalT[] {
  const bySection = new Map<number, SectionSubtotalT>()
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        net: 0,
        plannedNet: 0,
        share: 0,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
    }
    acc.net += rowValueForView(row, stages, view)
    acc.plannedNet += rowPlannedNetForView(row, view)
    acc.itemCount += 1
  }
  const result = [...bySection.values()]
  const grandNet = result.reduce((sum, s) => sum + s.net, 0)
  if (grandNet > 0) for (const s of result) s.share = s.net / grandNet
  return result
}
