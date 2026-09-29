'use client'

import { useRef, useState } from 'react'

type RestoreRemountT = {
  // Bump on the body's `key` to remount it. A restore reseeds the WHOLE grid, so it remounts the body
  // rather than patching rows in place — a full remount intentionally discards sort/filter/optimistic
  // state (lessons.md: never remount on a routine tree change).
  remountKey: number
  // Arm the one-shot: the next fresh-tree signal remounts. Call once the replacing action has
  // resolved — its render commits after the continuation, so the latch is armed in time.
  triggerRestore: () => void
}

// One-shot remount latch for a whole-tree reseed. After a restore (or a stale-tree recovery) the caller
// gets the fresh tree from the server, then we remount ONLY once that prop actually lands — keyed on a
// freshness token the caller builds, rather than on the `tree` prop's object identity (every render
// reshapes that, so a restore returning an identical-content tree would never fire an identity
// compare, leaving the latch stuck). `restorePending` gates it so the routine re-render an ordinary
// edit triggers doesn't remount. No useEffect: this render-phase compare is flash-free.
//
// Latching, rather than remounting straight from the caller's `await`, is what makes the reseed correct:
// the router applies a fresh tree in a transition whose commit nothing can await, so a remount dispatched
// from an action's continuation renders first — reseeding the body from the tree it already holds.
export function useRestoreRemount(token: string): RestoreRemountT {
  const [remountKey, setRemountKey] = useState(0)
  const [restorePending, setRestorePending] = useState(false)
  const prevToken = useRef(token)
  // Comparing/advancing the prev-value ref during render is the documented "store info from previous
  // render" pattern (the rule is too strict here) — same sanctioned use as use-kosztorys-editor.ts.
  // eslint-disable-next-line react-hooks/refs
  const tokenChanged = token !== prevToken.current
  // eslint-disable-next-line react-hooks/refs
  prevToken.current = token
  if (restorePending && tokenChanged) {
    setRestorePending(false)
    setRemountKey((k) => k + 1)
  }

  return { remountKey, triggerRestore: () => setRestorePending(true) }
}
