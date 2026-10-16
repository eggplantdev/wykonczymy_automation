'use client'

import { useEffect, useState } from 'react'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
import type { SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'
import { toastMessage } from '@/lib/utils/toast'

type SnapshotListT = {
  // null = not loaded yet (spinner); [] = loaded, empty.
  snapshots: SnapshotListItemT[] | null
  reset: () => void
}

// a controlled Radix Dialog fires onOpenChange only on dismiss, never with `true` on a programmatic open.
export function useSnapshotList(investmentId: number, open: boolean): SnapshotListT {
  const { listSnapshots } = useEditorActions()
  const [snapshots, setSnapshots] = useState<SnapshotListItemT[] | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    listSnapshots(investmentId)
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
  }, [open, investmentId, listSnapshots])

  return { snapshots, reset: () => setSnapshots(null) }
}
