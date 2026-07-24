'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { snapshotAction } from '@/lib/actions/kosztorys-snapshots'

// S-06 durable net: while the editor is open, take an auto snapshot on a plain interval, gated on the
// undo-stack revision (S-07) so an idle editor stops writing identical snapshots. The count cap + daily
// GC still bound the table.
const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000

type AutoSnapshotT = {
  // A restore reseeds a known-good baseline (not a user edit); call this so the next tick treats the
  // current revision as already-snapshotted and won't persist the just-restored state.
  skipNext: () => void
}

// Fire-and-forget periodic auto snapshot while the editor is mounted; a failed snapshot must never
// disrupt editing. `revisionRef` carries the live undo-stack revision (the interval closure captures
// values at setup, so it can't read a render-fresh value directly). A tick snapshots only when that
// revision moved since the last one — an untouched editor writes nothing.
export function useAutoSnapshot(
  investmentId: number,
  revisionRef: RefObject<number>,
): AutoSnapshotT {
  const lastSnapshotRevision = useRef<number | null>(null)

  useEffect(() => {
    // Seed the marker at mount (effects may read refs) so an unedited editor's first tick is a no-op.
    lastSnapshotRevision.current = revisionRef.current
    const id = setInterval(() => {
      if (revisionRef.current === lastSnapshotRevision.current) return
      lastSnapshotRevision.current = revisionRef.current
      void snapshotAction(investmentId)
    }, AUTO_SNAPSHOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [investmentId, revisionRef])

  // undoRedo.reset() bumps the revision by one, so advance the marker past that pending bump.
  return { skipNext: () => void (lastSnapshotRevision.current = revisionRef.current + 1) }
}
