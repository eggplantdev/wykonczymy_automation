'use client'

import { useState } from 'react'

type RestoreRemountT = {
  // Bump on the body's `key` to remount it. A restore reseeds the WHOLE grid, so it remounts the body
  // rather than patching rows in place — a full remount intentionally discards sort/filter/optimistic
  // state (lessons.md: never remount on a routine tree change).
  remountKey: number
  // Arm the one-shot: remount once the tree differs from `since` (default: the tree the body was
  // seeded from). An action's continuation passes the token it started from, because the action's own
  // render can commit before the continuation runs. `ownsRefresh`: this arm waits on the caller's
  // `isRefreshing` refresh, so that refresh settling on an unchanged tree disarms it.
  triggerRestore: (since?: string, ownsRefresh?: boolean) => void
}

// One-shot remount latch for a whole-tree reseed. After a restore (or a stale-tree recovery) the caller
// gets the fresh tree from the server, then we remount ONLY once that prop actually lands — keyed on a
// freshness token the caller builds, rather than on the `tree` prop's object identity (every render
// reshapes that, so a restore returning an identical-content tree would never fire an identity
// compare, leaving the latch stuck). `armed` gates it so the routine re-render an ordinary
// edit triggers doesn't remount. No useEffect: this render-phase compare is flash-free.
//
// Latching, rather than remounting straight from the caller's `await`, is what makes the reseed correct:
// the router applies a fresh tree in a transition whose commit nothing can await, so a remount dispatched
// from an action's continuation renders first — reseeding the body from the tree it already holds.
// Accepted race: a row added or removed between an action's click and its render moves the token by
// itself, firing the latch on that tree instead of the replaced one. Closing it would need every
// tree-replacing action to return its new revision to arm on — too much for a ~100 ms window.
//
// `isRefreshing` is the caller's own transition around the refresh that should bring the new tree. When
// it settles with the token unchanged, the write it was refetching never committed: left armed, the
// latch would fire on the next ordinary write instead and drop the edit still in the body's debounce.
// Only an arm that owns that refresh is disarmed — a restore re-arming while it is in flight brings its
// own tree, which can land after the refresh settles.
export function useRestoreRemount(token: string, isRefreshing = false): RestoreRemountT {
  const [remountKey, setRemountKey] = useState(0)
  const [armed, setArmed] = useState<{ from: string; ownsRefresh: boolean } | null>(null)
  // Not the token on screen: any ordinary write renders the route, so by the time a write comes back
  // NOT_FOUND the tree prop can already hold the other tab's change while the mount-seeded rows don't.
  // Arming from that token would wait for a change that has already landed.
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
