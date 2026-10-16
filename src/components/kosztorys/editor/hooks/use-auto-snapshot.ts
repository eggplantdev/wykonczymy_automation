'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { snapshotAction } from '@/lib/actions/kosztorys-snapshots'
import { settleAction } from '@/lib/utils/settle-action'

const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000

type AutoSnapshotT = {
  skipNext: () => void
}

export function useAutoSnapshot(
  investmentId: number,
  revisionRef: RefObject<number>,
): AutoSnapshotT {
  const lastSnapshotRevision = useRef<number | null>(null)

  useEffect(() => {
    lastSnapshotRevision.current = revisionRef.current
    const id = setInterval(() => {
      if (revisionRef.current === lastSnapshotRevision.current) return
      lastSnapshotRevision.current = revisionRef.current
      void settleAction(() => snapshotAction(investmentId))
    }, AUTO_SNAPSHOT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [investmentId, revisionRef])

  // undoRedo.reset() bumps the revision by one, so advance the marker past that pending bump.
  return { skipNext: () => void (lastSnapshotRevision.current = revisionRef.current + 1) }
}
