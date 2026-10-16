import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { groupInOrder, regroupByKeys } from '@/lib/utils/group-in-order'

// ONLY if nothing newer was typed since the failed save (current === attempted) — otherwise we
// would trample the user's fresher edit.
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

// a row parked past a later section would open a second band for a section that already has one —
// one id, two rows, duplicate keys in dsg's virtualizer.
export function applyAddItem(rows: KosztorysV2RowT[], row: KosztorysV2RowT): KosztorysV2RowT[] {
  let at = rows.length
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sectionId === row.sectionId) at = i + 1
  }
  return [...rows.slice(0, at), row, ...rows.slice(at)]
}

export type CatalogueSlicePlacementT = 'prepend' | 'fold' | 'reseed'

// `rows` is mount-frozen (EX-441), so only a re-seed from the server draws it.
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

export function groupBySection(rows: KosztorysV2RowT[]): Map<number, KosztorysV2RowT[]> {
  return groupInOrder(rows, (row) => row.sectionId)
}

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
