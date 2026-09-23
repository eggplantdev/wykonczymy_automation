'use client'

import { useMemo } from 'react'
import { createJsonMapStore, useJsonMap, type JsonMapStoreT } from '@/hooks/create-json-map-store'

// Which row conditions the user moved off their default, persisted in localStorage. Sparse: a key is
// present only while its condition is engaged, so an absent key is the default and an untouched
// kosztorys stores nothing. „Engaged", not „active": a filter's default is ON and engaging it means
// unticking it, so „active" would name the opposite state for half the registry.
//
// Per investment, like usePriceView and unlike the globally-keyed column hooks: a filter describes
// the state of one budowa, and carrying it to the next one would hide rows nobody chose to hide.
const STORAGE_KEY_PREFIX = 'kosztorys-filters:'

// createJsonMapStore binds its key at module scope, so a per-investment store has to be cached rather
// than built during render — a store built per render hands useSyncExternalStore a new `subscribe`
// every time and it resubscribes forever.
const storesByKey = new Map<string, JsonMapStoreT<boolean>>()

function storeFor(investmentId: number): JsonMapStoreT<boolean> {
  const key = `${STORAGE_KEY_PREFIX}${investmentId}`
  let store = storesByKey.get(key)
  if (!store) {
    store = createJsonMapStore<boolean>(key)
    storesByKey.set(key, store)
  }
  return store
}

export function useEngagedConditions(investmentId: number): {
  engagedIds: Set<string>
  toggle: (id: string) => void
  toggleExclusive: (id: string, within: Iterable<string>) => void
  setMany: (ids: Iterable<string>, engage: boolean) => void
  clear: () => void
} {
  const store = storeFor(investmentId)
  const engaged = useJsonMap<boolean>(store)

  // Ids nobody recognises are carried through untouched rather than pruned here: applyRowConditions
  // already ignores them, and deleting one would drop a filter the user set under a condition that is
  // only temporarily gone.
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

  // Engages `id` and drops every other id in `within` — one member of a group at a time. The group is
  // the caller's to name because this store holds two kinds at once: the „Problemy" list is exclusive,
  // the „Prace" filters stack, and an exclusivity that swept the whole store would untick those too.
  function toggleExclusive(id: string, within: Iterable<string>) {
    store.update((prev) => {
      const engaging = !prev[id]
      const next = { ...prev }
      for (const other of within) delete next[other]
      if (engaging) next[id] = true
      return next
    })
  }

  // A whole list in ONE store write, because localStorage is what is behind it: sixteen toggles in a
  // row would be sixteen serialisations of the same map and sixteen renders on the way to one state
  // the user asked for once. Named ids rather than „wszystko", for the same reason `toggleExclusive` takes
  // a group — the store holds the „Problemy" list too, and a sweep would untick that with it.
  // Returns `prev` untouched when every id already stands where it is being put, like `clear` below:
  // the store writes localStorage on every new identity, so „Odznacz wszystkie" pressed twice would
  // serialise the same map again and re-render the whole grid for nothing.
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
