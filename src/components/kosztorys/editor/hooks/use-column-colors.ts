'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'

// Grid column colours = id→palette key, persisted in localStorage like the widths — one browser's
// reading aid, never part of the kosztorys. Validated on read (isSectionColorKey) where it is painted.
const store = createJsonMapStore<SectionColorKeyT>('kosztorys-v2-col-colors')

export function useColumnColors(): {
  colors: Record<string, SectionColorKeyT>
  setColor: (id: string, color: SectionColorKeyT | null) => void
  dropColor: (...ids: string[]) => void
} {
  return {
    colors: useJsonMap(store),
    setColor: (id, color) => (color == null ? store.drop(id) : store.set(id, color)),
    dropColor: store.drop,
  }
}
