'use client'

import { useMemo, useSyncExternalStore } from 'react'

// Szerokości kolumn siatki = mapa id→px, trwała w localStorage. Rzadka: tylko kolumny,
// które user faktycznie przeciągnął, mają wpis — reszta zostaje na flex (grow/minWidth).
// Wzorzec jak useHiddenColumns: useSyncExternalStore zwraca string z localStorage (stabilna
// równość → brak pętli renderu), serwer i pierwszy render klienta dają ten sam pusty snapshot
// → zero niezgodności hydracji. Subskrypcja własna (storage-event nie odpala w tej samej karcie).

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
    // brak localStorage (SSR/prywatny tryb) — pomijamy trwałość, stan żyje w pamięci subskrybentów
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
