'use client'

import { useMemo } from 'react'
import { createJsonMapStore, useJsonMap, type JsonMapStoreT } from '@/hooks/create-json-map-store'

// createJsonMapStore binds its key at module scope, so a per-key store has to be cached rather than
// built during render — a store built per render hands useSyncExternalStore a new `subscribe` every
// time and it resubscribes forever.
const storesByKey = new Map<string, JsonMapStoreT<boolean>>()

function storeFor(key: string): JsonMapStoreT<boolean> {
  let store = storesByKey.get(key)
  if (!store) {
    store = createJsonMapStore<boolean>(key)
    storesByKey.set(key, store)
  }
  return store
}

export function useEngagedIds(storageKey: string): {
  engagedIds: Set<string>
  toggle: (id: string) => void
  toggleExclusive: (id: string, within: Iterable<string>) => void
  setMany: (ids: Iterable<string>, engage: boolean) => void
  clear: () => void
} {
  const store = storeFor(storageKey)
  const engaged = useJsonMap<boolean>(store)

  // Ids nobody recognises are carried through untouched rather than pruned here: deleting one would
  // drop a filter the user set under a condition that is only temporarily gone.
  const engagedIds = useMemo(
    () => new Set(Object.keys(engaged).filter((id) => engaged[id])),
    [engaged],
  )

  function toggle(id: string) {
    store.update((prev) => {
      if (!prev[id]) return { ...prev, [id]: true }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // The group is the caller's to name because this store holds two kinds at once: the „Problemy" list
  // is exclusive, the filters stack, and an exclusivity that swept the whole store would untick those too.
  function toggleExclusive(id: string, within: Iterable<string>) {
    store.update((prev) => {
      const engaging = !prev[id]
      const next = { ...prev }
      for (const other of within) delete next[other]
      if (engaging) next[id] = true
      return next
    })
  }

  function setMany(ids: Iterable<string>, engage: boolean) {
    store.update((prev) => {
      const next = { ...prev }
      let changed = false
      for (const id of ids) {
        if (engage === Boolean(next[id])) continue
        changed = true
        if (engage) next[id] = true
        else delete next[id]
      }
      return changed ? next : prev
    })
  }

  function clear() {
    store.update((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }

  return { engagedIds, toggle, toggleExclusive, setMany, clear }
}
