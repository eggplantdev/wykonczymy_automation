'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'

const store = createJsonMapStore<number>('kosztorys-v2-col-widths')

// `dropWidth` matters because a stage column's id is derived from its DB id, which Postgres can hand
// out again after the stage is deleted — a leftover entry would silently pin a brand-new stage to the
// dead one's width.
export function useColumnWidths(): {
  widths: Record<string, number>
  setWidth: (id: string, width: number) => void
  dropWidth: (...ids: string[]) => void
} {
  return { widths: useJsonMap(store), setWidth: store.set, dropWidth: store.drop }
}
