'use client'

import { useMemo, useSyncExternalStore } from 'react'

// Grid column widths = id→px map, persisted in localStorage. Sparse: only columns the user
// actually dragged get an entry — the rest stay on flex (grow/minWidth).
// Same pattern as useHiddenColumns: useSyncExternalStore returns a string from localStorage (stable
// equality → no render loop), server and first client render yield the same empty snapshot
// → zero hydration mismatch. Own subscription (the storage event doesn't fire in the same tab).

const STORAGE_KEY = 'kosztorys-v2-col-widths'
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

function writeWidths(widths: Record<string, number>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
  } catch {
    // no localStorage (SSR/private mode) — skip persistence, state lives in subscribers' memory
  }
  for (const l of listeners) l()
}

// Returns the map without `ids`, or the SAME reference when none of them were pinned — identity is
// how the caller tells "nothing to drop" from "dropped", so it can skip a pointless write + notify.
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
  const json = useSyncExternalStore(subscribe, readJson, () => SERVER_SNAPSHOT)
  const widths = useMemo(() => JSON.parse(json) as Record<string, number>, [json])

  function setWidth(id: string, width: number) {
    writeWidths({ ...widths, [id]: width })
  }

  // A stage column's id is derived from its DB id, which Postgres can hand out again after the
  // stage is deleted — so a leftover entry would silently pin a brand-new stage to the dead one's
  // width. Called when a stage goes away.
  // Variadic because one stage owns several columns (ilość + kwota netto + kwota brutto) and each
  // write rebuilds the whole map from the render's `widths`: dropping them one call at a time would
  // have every call read the same pre-delete map, so the last write would resurrect the others.
  function dropWidth(...ids: string[]) {
    const next = dropKeys(widths, ids)
    if (next !== widths) writeWidths(next)
  }

  return { widths, setWidth, dropWidth }
}
