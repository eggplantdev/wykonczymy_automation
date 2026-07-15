'use client'

import { useMemo, useSyncExternalStore } from 'react'

// Which grid columns the user hid, persisted in localStorage. Sparse: only columns explicitly
// switched off get an entry, so a new column ships visible without a migration.
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

export function useHiddenColumns(): {
  hidden: Record<string, boolean>
  isHidden: (id: string) => boolean
  toggleColumn: (id: string) => void
} {
  const json = useSyncExternalStore(subscribe, readJson, () => SERVER_SNAPSHOT)
  const hidden = useMemo(() => JSON.parse(json) as Record<string, boolean>, [json])

  function isHidden(id: string) {
    return hidden[id] === true
  }

  function toggleColumn(id: string) {
    const next = { ...hidden }
    if (next[id]) delete next[id]
    else next[id] = true
    writeHidden(next)
  }

  return { hidden, isHidden, toggleColumn }
}
