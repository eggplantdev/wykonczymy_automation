import { DEFAULT_ITEM_DESCRIPTION, DEFAULT_UNIT } from '@/lib/kosztorys/constants'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import { groupInOrder, regroupByKeys } from '@/lib/utils/group-in-order'

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
  sectionColor: SectionColorKeyT | null
  vatRate: number
  globalDiscountActive: boolean
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
  stages: KosztorysStageT[]
}

// Blank item row = createBlankItem's server defaults + denormalized section fields
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
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 0,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
    note: null,
    sectionName: input.sectionName,
    sectionColor: input.sectionColor,
    vatRate: input.vatRate,
    globalDiscountActive: input.globalDiscountActive,
    globalWToolsCoeff: input.globalWToolsCoeff,
    globalOwnToolsCoeff: input.globalOwnToolsCoeff,
    ...stageFields,
  } as KosztorysV2RowT
}

// Lands after the LAST row of its own section, not at the end of the array: the grid groups rows into
// section bands by walking them in order, so a row parked past a later section would open a second
// band for a section that already has one — one id, two rows, duplicate keys in dsg's virtualizer.
// A section with no rows yet (a fresh section's first item) has nothing to follow, so it appends.
export function applyAddItem(rows: KosztorysV2RowT[], row: KosztorysV2RowT): KosztorysV2RowT[] {
  let at = rows.length
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sectionId === row.sectionId) at = i + 1
  }
  return [...rows.slice(0, at), row, ...rows.slice(at)]
}

export type CatalogueSlicePlacementT = 'prepend' | 'fold' | 'reseed'

// `reseed` is the case the two obvious branches miss: the server matched the typed nazwa to a sekcja
// this grid holds no row for — emptied of its pozycje (a 0-row sekcja is absent from the picker's
// list, which is why the nazwa was typed at all) or created elsewhere since mount. `applyAddItem`
// would then have no anchor and append past the LAST sekcja, drawing the band in the wrong place
// until a full reload, because `rows` is mount-frozen (EX-441).
export function catalogueSlicePlacement(
  rows: readonly KosztorysV2RowT[],
  sectionId: number,
  createdSection: boolean,
): CatalogueSlicePlacementT {
  if (createdSection) return 'prepend'
  return rows.some((row) => row.sectionId === sectionId) ? 'fold' : 'reseed'
}

export function applyRemoveItem(rows: KosztorysV2RowT[], itemId: number): KosztorysV2RowT[] {
  return rows.filter((r) => r.id !== itemId)
}

// Put a removed row back after a failed delete. `afterId` is the id the row followed at removal time
// (null = it was first). Resolved against the CURRENT array, not a stale index, so a concurrent
// add/remove/reorder during the delete's await can't misplace it: land right after `afterId` if it's
// still present, at the front if the row was first, else append.
export function applyRestoreItem(
  rows: KosztorysV2RowT[],
  row: KosztorysV2RowT,
  afterId: number | null,
): KosztorysV2RowT[] {
  if (afterId === null) return [row, ...rows]
  const anchor = rows.findIndex((r) => r.id === afterId)
  const at = anchor < 0 ? rows.length : anchor + 1
  return [...rows.slice(0, at), row, ...rows.slice(at)]
}

// Splice a blank row into the display sequence just before or just after the anchor. Array position
// (not display_order) drives the unsorted grid render, so the row lands at the anchor's array index.
// The server's tail shift needs no client mirror: no client code does arithmetic on display_order.
export function applyInsertItem(
  rows: KosztorysV2RowT[],
  anchorId: number,
  newRow: KosztorysV2RowT,
  dir: 'above' | 'below',
): KosztorysV2RowT[] {
  const anchorIdx = rows.findIndex((r) => r.id === anchorId)
  if (anchorIdx < 0) return rows
  const insertIdx = dir === 'above' ? anchorIdx : anchorIdx + 1
  return [...rows.slice(0, insertIdx), newRow, ...rows.slice(insertIdx)]
}

// Move an item one place within ITS section (▲/▼). Operates on the display sequence
// of items in the same section (their order in `rows`), NOT on block contiguity —
// this way a section whose rows are not adjacent still moves the pair the user sees.
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

// Rows grouped by section, in the order the sections first appear.
export function groupBySection(rows: KosztorysV2RowT[]): Map<number, KosztorysV2RowT[]> {
  return groupInOrder(rows, (row) => row.sectionId)
}

// Splice the first row of a newly inserted section into the display sequence, just before or just
// after the anchor section's block.
export function applyInsertSectionRow(
  rows: KosztorysV2RowT[],
  anchorSectionId: number,
  row: KosztorysV2RowT,
  dir: 'above' | 'below',
): KosztorysV2RowT[] {
  const blocks = groupBySection(rows)
  const seq = [...blocks.keys()]
  const pos = seq.indexOf(anchorSectionId)
  if (pos < 0) return [...rows, row]
  seq.splice(dir === 'above' ? pos : pos + 1, 0, row.sectionId)
  blocks.set(row.sectionId, [row])
  return regroupByKeys(blocks, seq)
}

// „Zapisz kolejność": re-lay every block in the id sequence just sent to the server. A row the
// sequence doesn't mention keeps the slot it occupies, so a stale sequence degrades to a partial
// reorder rather than a scramble — the mentioned rows are sorted into the positions they already
// hold between them.
export function applyKosztorysOrder(
  rows: KosztorysV2RowT[],
  orderedIds: number[],
): KosztorysV2RowT[] {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  const blocks = groupBySection(rows)
  for (const [sectionId, block] of blocks) {
    const ordered = block
      .filter((row) => rank.has(row.id))
      .sort((a, b) => (rank.get(a.id) as number) - (rank.get(b.id) as number))
    let taken = 0
    blocks.set(
      sectionId,
      block.map((row) => (rank.has(row.id) ? ordered[taken++] : row)),
    )
  }
  return regroupByKeys(blocks, [...blocks.keys()])
}

export function neighborSectionId(
  rows: KosztorysV2RowT[],
  sectionId: number,
  dir: 'up' | 'down',
): number | undefined {
  const seq = [...groupBySection(rows).keys()]
  const pos = seq.indexOf(sectionId)
  if (pos < 0) return undefined
  return seq[dir === 'up' ? pos - 1 : pos + 1]
}

// Move a whole section one place (▲/▼). Same reference on a no-op (edge / unknown id).
export function swapSectionBlock(
  rows: KosztorysV2RowT[],
  sectionId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT[] {
  const blocks = groupBySection(rows)
  const seq = [...blocks.keys()]
  const pos = seq.indexOf(sectionId)
  const targetPos = dir === 'up' ? pos - 1 : pos + 1
  if (pos < 0 || targetPos < 0 || targetPos >= seq.length) return rows
  ;[seq[pos], seq[targetPos]] = [seq[targetPos], seq[pos]]
  return regroupByKeys(blocks, seq)
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
