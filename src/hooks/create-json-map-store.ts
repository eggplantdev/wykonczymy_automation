'use client'

import { useMemo, useSyncExternalStore } from 'react'

// Shared localStorage-backed JSON-map store for the kosztorys column hooks (useColumnWidths,
// useHiddenColumns). Each was a hand-rolled copy of the same useSyncExternalStore + Set<listeners> +
// read/write/notify scaffolding; this is the one primitive they delegate to. usePersistedEnum is its
// scalar sibling.
//
// Own subscription (not a `storage` event, which doesn't fire in the same tab). getSnapshot returns
// the raw string so server and first client render agree on the empty snapshot → no hydration
// mismatch, and useSyncExternalStore's string equality skips redundant re-renders. Writes are
// updater-based: the updater re-reads the persisted map at write time, so two writes in one tick
// can't clobber each other through a stale render closure.

export const EMPTY_MAP_SNAPSHOT = '{}'

// Reject anything that isn't a plain object. JSON.parse('null') is null, and arrays/primitives parse
// fine too — any of them would make a later `map[id]` read throw and permanently white-screen the
// grid (nothing clears the key). A corrupt value throws and lands here as well. All degrade to an
// empty map, which is also the sparse-map default.
export function parseJsonMap<V>(json: string): Record<string, V> {
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, V>
    }
  } catch {
    // corrupt localStorage value — fall through to the empty map
  }
  return {}
}

export type JsonMapStoreT<V> = {
  subscribe: (callback: () => void) => () => void
  getSnapshot: () => string
  update: (updater: (prev: Record<string, V>) => Record<string, V>) => void
}

export function createJsonMapStore<V>(storageKey: string): JsonMapStoreT<V> {
  const listeners = new Set<() => void>()

  function subscribe(callback: () => void) {
    listeners.add(callback)
    return () => {
      listeners.delete(callback)
    }
  }

  function getSnapshot(): string {
    try {
      return window.localStorage.getItem(storageKey) ?? EMPTY_MAP_SNAPSHOT
    } catch {
      return EMPTY_MAP_SNAPSHOT
    }
  }

  // Re-reads the persisted map before applying `updater`, so a write never rebuilds from a stale
  // render closure. An updater that returns its input unchanged (identity) skips persist + notify.
  function update(updater: (prev: Record<string, V>) => Record<string, V>) {
    const prev = parseJsonMap<V>(getSnapshot())
    const next = updater(prev)
    if (next === prev) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // no localStorage (SSR/private mode) — persistence skipped, state lives in subscribers' memory
    }
    for (const listener of listeners) listener()
  }

  return { subscribe, getSnapshot, update }
}

// The parsed map, re-derived only when the persisted string changes. Domain hooks layer their own
// reader/writer API (isHidden/toggleColumn, setWidth/dropWidth) on top of this.
export function useJsonMap<V>(store: JsonMapStoreT<V>): Record<string, V> {
  const json = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_MAP_SNAPSHOT)
  return useMemo(() => parseJsonMap<V>(json), [json])
}
