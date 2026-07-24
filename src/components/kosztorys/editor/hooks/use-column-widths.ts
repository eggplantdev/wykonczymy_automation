'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'

// Grid column widths = id→px map, persisted in localStorage. Sparse: only columns the user actually
// dragged get an entry — the rest stay on flex (grow/minWidth). Store mechanics (subscribe, safe
// read, updater-based write) live in createJsonMapStore, shared with useHiddenColumns.
const store = createJsonMapStore<number>('kosztorys-v2-col-widths')

// Returns the map without `ids`, or the SAME reference when none of them were pinned — identity is
// how the store's update() tells "nothing to drop" from "dropped", so it skips a pointless write.
export function dropKeys(widths: Record<string, number>, ids: string[]): Record<string, number> {
  if (!ids.some((id) => id in widths)) return widths
  const next = { ...widths }
  for (const id of ids) delete next[id]
  return next
}

export function useColumnWidths(): {
  widths: Record<string, number>
  setWidth: (id: string, width: number) => void
  dropWidth: (...ids: string[]) => void
} {
  const widths = useJsonMap(store)

  function setWidth(id: string, width: number) {
    store.update((prev) => ({ ...prev, [id]: width }))
  }

  // A stage column's id is derived from its DB id, which Postgres can hand out again after the stage
  // is deleted — so a leftover entry would silently pin a brand-new stage to the dead one's width.
  // Variadic so a stage's several columns (ilość + kwota netto + brutto + %) drop in one write
  // instead of one re-render each.
  function dropWidth(...ids: string[]) {
    store.update((prev) => dropKeys(prev, ids))
  }

  return { widths, setWidth, dropWidth }
}
