'use client'

import { useEffect, useState } from 'react'
import { listSnapshotsAction, type SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'
import { toastMessage } from '@/lib/utils/toast'

type SnapshotListT = {
  // null = not loaded yet (spinner); [] = loaded, empty.
  snapshots: SnapshotListItemT[] | null
  // Drop the loaded list back to the spinner state (on close / after a restore) so a reopen refetches.
  reset: () => void
}

// Load the snapshot list whenever the drawer becomes visible. Keyed on the `open` state, NOT a click
// handler, because the drawer is controlled by the parent toolbar and never sees the opening click — a
// controlled Radix Dialog fires onOpenChange only on dismiss, never with `true` on a programmatic open.
// Keying on visibility also means every path that opens the drawer refetches (today the toolbar,
// tomorrow an auto-open after restore), which a trigger-click handler would miss. `active` drops a
// response that lands after a close/reopen so a stale fetch can't populate the reopened list.
export function useSnapshotList(investmentId: number, open: boolean): SnapshotListT {
  const [snapshots, setSnapshots] = useState<SnapshotListItemT[] | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    listSnapshotsAction(investmentId)
      .then((res) => {
        if (!active) return
        if (!res.success) {
          toastMessage(res.error ?? 'Nie udało się wczytać wersji', 'error', 4000)
          setSnapshots([])
          return
        }
        setSnapshots(res.data)
      })
      // A transport-level RPC rejection never resolves to {success:false}; without this the spinner
      // would hang forever on a dropped request.
      .catch(() => {
        if (!active) return
        toastMessage('Nie udało się wczytać wersji', 'error', 4000)
        setSnapshots([])
      })
    return () => {
      active = false
    }
  }, [open, investmentId])

  return { snapshots, reset: () => setSnapshots(null) }
}
