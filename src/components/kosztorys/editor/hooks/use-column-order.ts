'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'
import { type ColumnPrefsScopeT } from '@/components/kosztorys/editor/hooks/use-hidden-columns'
import { dropNonFiniteRanks, type ColumnRanksT } from '@/lib/table/column-order'

const kosztorysStore = createJsonMapStore<number>('kosztorys-v2-col-order')
const workshopStore = createJsonMapStore<number>('kosztorys-v2-col-order:szablon')

export function useColumnOrder(scope: ColumnPrefsScopeT = 'kosztorys'): {
  ranks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
} {
  const store = scope === 'workshop' ? workshopStore : kosztorysStore
  const ranks = dropNonFiniteRanks(useJsonMap<number>(store))

  function resetOrder() {
    store.update((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }

  return { ranks, setRank: store.set, resetOrder }
}
