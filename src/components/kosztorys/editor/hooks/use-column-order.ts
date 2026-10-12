'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'
import { type ColumnPrefsScopeT } from '@/components/kosztorys/editor/hooks/use-hidden-columns'
import { dropNonFiniteRanks, type ColumnRanksT } from '@/lib/table/column-order'

// User-defined column order = group key → rank, persisted in localStorage. Sparse: only groups the
// owner actually dragged get an entry, so an empty map is exactly today's sheet order and a column
// added later ships at its declared position. Global, not per-kosztorys — a reading order is a
// property of the person reading, like widths and hidden columns. Store mechanics live in
// createJsonMapStore, shared with useColumnWidths / useHiddenColumns.
const kosztorysStore = createJsonMapStore<number>('kosztorys-v2-col-order')
// The szablon workbench's own order, for the same reason as its hidden-columns map.
const workshopStore = createJsonMapStore<number>('kosztorys-v2-col-order:szablon')

// Returns the raw map, unlike useHiddenColumns: here an absent key means "rank at the assemble
// index", a fallback only orderColumnKeys can resolve (it needs the whole list), so there is no
// per-key reader that could lie.
export function useColumnOrder(scope: ColumnPrefsScopeT = 'kosztorys'): {
  ranks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
} {
  const store = scope === 'workshop' ? workshopStore : kosztorysStore
  const ranks = dropNonFiniteRanks(useJsonMap<number>(store))

  // Writes an empty map rather than removing the key — subscribers are notified through update(),
  // and the identity return on an already-empty map skips a pointless write.
  function resetOrder() {
    store.update((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }

  return { ranks, setRank: store.set, resetOrder }
}
