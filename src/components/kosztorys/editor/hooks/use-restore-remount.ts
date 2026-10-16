'use client'

import { useState } from 'react'

type RestoreRemountT = {
  remountKey: number
  // An action's continuation passes the token it started from, because the action's own
  // render can commit before the continuation runs.
  triggerRestore: (since?: string, ownsRefresh?: boolean) => void
}

// When it settles with the token unchanged, the write it was refetching never committed: left armed, the
// latch would fire on the next ordinary write instead and drop the edit still in the body's debounce.
export function useRestoreRemount(token: string, isRefreshing = false): RestoreRemountT {
  const [remountKey, setRemountKey] = useState(0)
  const [armed, setArmed] = useState<{ from: string; ownsRefresh: boolean } | null>(null)
  // by the time a write comes back NOT_FOUND the tree prop can already hold the other tab's change
  // while the mount-seeded rows don't.
  const [seededFrom, setSeededFrom] = useState(token)
  const [wasRefreshing, setWasRefreshing] = useState(isRefreshing)
  if (wasRefreshing !== isRefreshing) setWasRefreshing(isRefreshing)
  // The fresh tree commits in the same render the refresh settles in, so the fire check goes first.
  if (armed && token !== armed.from) {
    setArmed(null)
    setSeededFrom(token)
    setRemountKey((k) => k + 1)
  } else if (armed?.ownsRefresh && wasRefreshing && !isRefreshing) {
    setArmed(null)
  }

  return {
    remountKey,
    triggerRestore: (since, ownsRefresh = false) =>
      setArmed({ from: since ?? seededFrom, ownsRefresh }),
  }
}
