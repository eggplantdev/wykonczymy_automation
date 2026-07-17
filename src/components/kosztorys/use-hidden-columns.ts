'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { DEFAULT_HIDDEN_COLUMNS } from '@/lib/kosztorys/constants'

// Which grid columns the user hid, persisted in localStorage. Sparse: an absent key means "whatever
// DEFAULT_HIDDEN_COLUMNS says", so a new column ships at its declared default without a migration
// and the default stays changeable in code afterwards. Seeding defaults into the map instead would
// freeze them into every user's localStorage and make a seeded default indistinguishable from a
// deliberate choice.
//
// The `table-columns:` prefix is shared with the TanStack tables (transfers, investments…) so every
// "which columns do I want" preference clears as one family. The mechanism deliberately is NOT
// theirs: they read in an effect after hydration to dodge an SSR mismatch, whereas
// useSyncExternalStore yields the same empty snapshot on server and first client render — same
// safety, no post-hydration flash of a column about to vanish. Matches useColumnWidths /
// usePriceView, this grid's siblings.
//
// Global, not per-investment — like useColumnWidths and unlike usePriceView. A preferred column set
// is a property of the person reading, not of the kosztorys being read.

const STORAGE_KEY = 'table-columns:kosztorys'
const SERVER_SNAPSHOT = '{}'

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function readJson(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? SERVER_SNAPSHOT
  } catch {
    return SERVER_SNAPSHOT
  }
}

function writeHidden(hidden: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden))
  } catch {
    // no localStorage (SSR/private mode) — skip persistence, state lives in subscribers' memory
  }
  for (const l of listeners) l()
}

// The raw map is deliberately NOT returned: an absent key means "ask DEFAULT_HIDDEN_COLUMNS", so a
// caller reading hidden[id] would silently get the pre-default answer. isHidden is the only honest
// reader of it.
export function useHiddenColumns(): {
  isHidden: (id: string) => boolean
  toggleColumn: (id: string) => void
  showAllColumns: (ids: string[]) => void
} {
  const json = useSyncExternalStore(subscribe, readJson, () => SERVER_SNAPSHOT)
  const hidden = useMemo(() => JSON.parse(json) as Record<string, boolean>, [json])

  function isHidden(id: string) {
    return hidden[id] ?? DEFAULT_HIDDEN_COLUMNS.has(id)
  }

  // Writes an explicit boolean either way: deleting the key means "revert to default", not "show" —
  // which for a default-hidden column would undo the very toggle that asked to show it.
  function toggleColumn(id: string) {
    writeHidden({ ...hidden, [id]: !isHidden(id) })
  }

  // Reveals every passed column. The caller supplies the id set (from the picker) because the map is
  // sparse — the hook alone can't enumerate default-hidden columns to un-hide.
  function showAllColumns(ids: string[]) {
    writeHidden({ ...hidden, ...Object.fromEntries(ids.map((id) => [id, false])) })
  }

  return { isHidden, toggleColumn, showAllColumns }
}
