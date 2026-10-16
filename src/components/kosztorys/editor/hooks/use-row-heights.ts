'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'

const store = createJsonMapStore<number>('kosztorys-v2-row-heights')
// Template item ids overlap kosztorys item ids, so a szablon keeps its own map.
const templateStore = createJsonMapStore<number>('szablon-row-heights')

// `dropHeight` matters because Postgres hands a deleted row's id back out eventually, so a leftover
// entry would silently pin a brand-new pozycja to the dead one's height. Variadic so deleting a whole
// section drops its rows in one write instead of one re-render each.
export function useRowHeights(isTemplate = false): {
  heights: Record<string, number>
  setHeight: (rowId: string, height: number) => void
  dropHeight: (...rowIds: string[]) => void
} {
  const active = isTemplate ? templateStore : store
  return { heights: useJsonMap(active), setHeight: active.set, dropHeight: active.drop }
}
