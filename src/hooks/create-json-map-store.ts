'use client'

import { useMemo, useSyncExternalStore } from 'react'

// getSnapshot returns the raw string so server and first client render agree on the empty snapshot →
// no hydration mismatch, and useSyncExternalStore's string equality skips redundant re-renders.

export const EMPTY_MAP_SNAPSHOT = '{}'

// JSON.parse('null') is null, and arrays/primitives parse fine too — any of them would make a later
// `map[id]` read throw and permanently white-screen the grid (nothing clears the key).
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

export function dropKeys<V>(map: Record<string, V>, keys: string[]): Record<string, V> {
  if (!keys.some((key) => key in map)) return map
  const next = { ...map }
  for (const key of keys) delete next[key]
  return next
}

export type JsonMapStoreT<V> = {
  subscribe: (callback: () => void) => () => void
  getSnapshot: () => string
  update: (updater: (prev: Record<string, V>) => Record<string, V>) => void
  set: (key: string, value: V) => void
  drop: (...keys: string[]) => void
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
  // render closure.
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

  return {
    subscribe,
    getSnapshot,
    update,
    set: (key, value) => update((prev) => ({ ...prev, [key]: value })),
    drop: (...keys) => update((prev) => dropKeys(prev, keys)),
  }
}

export function useJsonMap<V>(store: JsonMapStoreT<V>): Record<string, V> {
  const json = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_MAP_SNAPSHOT)
  return useMemo(() => parseJsonMap<V>(json), [json])
}
