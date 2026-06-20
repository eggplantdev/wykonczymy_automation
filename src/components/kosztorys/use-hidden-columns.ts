'use client'

import { useMemo, useSyncExternalStore } from 'react'

// Widoczność kolumn siatki = zbiór ukrytych id, trwały w localStorage (parytet z v1).
// useSyncExternalStore zamiast useState(localStorage): serwer i pierwszy render klienta
// dają ten sam pusty snapshot → zero niezgodności hydracji. Po hydracji render przeskakuje
// na wartość z localStorage. Subskrypcja własna (storage-event nie odpala w tej samej karcie).

const STORAGE_KEY = 'kosztorys-v2-hidden-cols'
const SERVER_SNAPSHOT = '[]'

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

function writeHidden(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // brak localStorage (SSR/prywatny tryb) — pomijamy trwałość, stan i tak żyje w pamięci subskrybentów
  }
  for (const l of listeners) l()
}

export function useHiddenColumns(): {
  hidden: Set<string>
  toggle: (id: string) => void
} {
  const json = useSyncExternalStore(subscribe, readJson, () => SERVER_SNAPSHOT)
  const hidden = useMemo(() => new Set<string>(JSON.parse(json) as string[]), [json])

  function toggle(id: string) {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    writeHidden([...next])
  }

  return { hidden, toggle }
}
