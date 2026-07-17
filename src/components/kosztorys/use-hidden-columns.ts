'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'
import { DEFAULT_HIDDEN_COLUMNS } from '@/lib/kosztorys/column-config'

// Which grid columns the user hid, persisted in localStorage. Sparse: an absent key means "whatever
// DEFAULT_HIDDEN_COLUMNS says", so a new column ships at its declared default without a migration
// and the default stays changeable in code afterwards. Seeding defaults into the map instead would
// freeze them into every user's localStorage and make a seeded default indistinguishable from a
// deliberate choice.
//
// The `table-columns:` prefix is shared with the TanStack tables (transfers, investments…) so every
// "which columns do I want" preference clears as one family. Global, not per-investment — a preferred
// column set is a property of the person reading, not of the kosztorys being read. Store mechanics
// live in createJsonMapStore, shared with useColumnWidths.
const store = createJsonMapStore<boolean>('table-columns:kosztorys')

// The raw map is deliberately NOT returned: an absent key means "ask DEFAULT_HIDDEN_COLUMNS", so a
// caller reading hidden[id] would silently get the pre-default answer. isHidden is the only honest
// reader of it.
export function useHiddenColumns(): {
  isHidden: (id: string) => boolean
  toggleColumn: (id: string) => void
  showAllColumns: (ids: string[]) => void
} {
  const hidden = useJsonMap(store)

  function isHidden(id: string) {
    return hidden[id] ?? DEFAULT_HIDDEN_COLUMNS.has(id)
  }

  // Writes an explicit boolean either way: deleting the key means "revert to default", not "show" —
  // which for a default-hidden column would undo the very toggle that asked to show it. Toggles
  // against the freshly-read map (via update), not the render's, so two toggles in one tick don't
  // revert each other.
  function toggleColumn(id: string) {
    store.update((prev) => ({ ...prev, [id]: !(prev[id] ?? DEFAULT_HIDDEN_COLUMNS.has(id)) }))
  }

  // Reveals every passed column. The caller supplies the id set (from the picker) because the map is
  // sparse — the hook alone can't enumerate default-hidden columns to un-hide.
  function showAllColumns(ids: string[]) {
    store.update((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, false])) }))
  }

  return { isHidden, toggleColumn, showAllColumns }
}
