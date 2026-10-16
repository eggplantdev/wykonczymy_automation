'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'

const store = createJsonMapStore<number>('kosztorys-v2-row-heights')

export function useRowHeights(): {
  heights: Record<string, number>
  setHeight: (rowId: string, height: number) => void
  dropHeight: (...rowIds: string[]) => void
} {
  return { heights: useJsonMap(store), setHeight: store.set, dropHeight: store.drop }
}
