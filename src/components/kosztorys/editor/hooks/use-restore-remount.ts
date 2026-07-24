'use client'

import { useRef, useState } from 'react'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

type RestoreRemountT = {
  // Bump on the body's `key` to remount it. A restore reseeds the WHOLE grid, so it remounts the body
  // rather than patching rows in place — a full remount intentionally discards sort/filter/optimistic
  // state (lessons.md: never remount on a routine tree change).
  remountKey: number
  // Arm the one-shot: the next fresh-tree signal remounts. Call right after kicking a restore's
  // router.refresh().
  triggerRestore: () => void
}

// One-shot remount latch for a restore. After a restore the caller router.refresh()es for the restored
// tree, then we remount ONLY once the fresh prop actually lands — keyed on the server revision token
// (investment.updatedAt), which a restore always bumps, rather than on the `tree` prop's object identity
// (router.refresh reshapes that on every refresh, so a restore returning an identical-content tree would
// never fire an identity compare, leaving the latch stuck). `restorePending` gates it so the routine
// totals-refresh an ordinary edit triggers doesn't remount. No useEffect: this render-phase compare is
// flash-free.
export function useRestoreRemount(tree: KosztorysTreeT): RestoreRemountT {
  const [remountKey, setRemountKey] = useState(0)
  const [restorePending, setRestorePending] = useState(false)
  const prevRevision = useRef(tree.revision)
  const prevEmpty = useRef(tree.sections.length === 0)
  // Comparing/advancing the prev-value ref during render is the documented "store info from previous
  // render" pattern (the rule is too strict here) — same sanctioned use as use-kosztorys-editor.ts.
  // eslint-disable-next-line react-hooks/refs
  const revisionChanged = tree.revision !== prevRevision.current
  // eslint-disable-next-line react-hooks/refs
  prevRevision.current = tree.revision
  // A seed-from-preset inserts the whole tree but does NOT write the investment row, so `revision`
  // (investment.updatedAt) is unchanged — the empty→populated transition is that path's fresh-tree
  // signal instead.
  // eslint-disable-next-line react-hooks/refs
  const becamePopulated = prevEmpty.current && tree.sections.length > 0
  // eslint-disable-next-line react-hooks/refs
  prevEmpty.current = tree.sections.length === 0
  if (restorePending && (revisionChanged || becamePopulated)) {
    setRestorePending(false)
    setRemountKey((k) => k + 1)
  }

  return { remountKey, triggerRestore: () => setRestorePending(true) }
}
