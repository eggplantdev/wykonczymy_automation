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

export function useColumnWidths(): {
  widths: Record<string, number>
  setWidth: (id: string, width: number) => void
} {
  const json = useSyncExternalStore(subscribe, readJson, () => SERVER_SNAPSHOT)
  const widths = useMemo(() => JSON.parse(json) as Record<string, number>, [json])

  function setWidth(id: string, width: number) {
    writeWidths({ ...widths, [id]: width })
  }

  return { widths, setWidth }
}
