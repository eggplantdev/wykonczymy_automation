'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'
import { DEFAULT_HIDDEN_COLUMNS } from '@/lib/kosztorys/columns/column-config'

const kosztorysStore = createJsonMapStore<boolean>('table-columns:kosztorys')
// No defaults — WORKSHOP_VISIBLE_COLUMNS is already the curated set, and „Sekcja" hidden by default
// would be missing from it on a first visit.
const workshopStore = createJsonMapStore<boolean>('table-columns:kosztorys-szablon')
const NO_DEFAULT_HIDDEN: ReadonlySet<string> = new Set()

export type ColumnPrefsScopeT = 'kosztorys' | 'workshop'

export function useHiddenColumns(scope: ColumnPrefsScopeT = 'kosztorys'): {
  isHidden: (id: string) => boolean
  toggleColumn: (id: string) => void
  setAllColumns: (ids: string[], hidden: boolean) => void
} {
  const store = scope === 'workshop' ? workshopStore : kosztorysStore
  const defaults = scope === 'workshop' ? NO_DEFAULT_HIDDEN : DEFAULT_HIDDEN_COLUMNS
  const hidden = useJsonMap(store)

  function isHidden(id: string) {
    return hidden[id] ?? defaults.has(id)
  }

  // Writes an explicit boolean either way: deleting the key means "revert to default", not "show" —
  // which for a default-hidden column would undo the very toggle that asked to show it.
  function toggleColumn(id: string) {
    store.update((prev) => ({ ...prev, [id]: !(prev[id] ?? defaults.has(id)) }))
  }

  function setAllColumns(ids: string[], hidden: boolean) {
    store.update((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, hidden])) }))
  }

  return { isHidden, toggleColumn, setAllColumns }
}
