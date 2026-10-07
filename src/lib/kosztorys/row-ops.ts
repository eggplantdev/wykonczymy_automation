import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
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
// this grid doesn't list — created elsewhere since mount. There is no band to fold into, and `rows`
// is mount-frozen (EX-441), so only a re-seed from the server draws it. A listed sekcja with no
// pozycje folds: the section list already places it.
export function catalogueSlicePlacement(
  sectionIds: ReadonlySet<number>,
  sectionId: number,
  createdSection: boolean,
): CatalogueSlicePlacementT {
  if (createdSection) return 'prepend'
  return sectionIds.has(sectionId) ? 'fold' : 'reseed'
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

// Splice a row into the display sequence just before or just after the anchor. Array position
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

// Rows grouped by section, in the order the sections first appear.
export function groupBySection(rows: KosztorysV2RowT[]): Map<number, KosztorysV2RowT[]> {
  return groupInOrder(rows, (row) => row.sectionId)
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
