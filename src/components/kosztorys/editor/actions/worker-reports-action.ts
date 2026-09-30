'use client'

import { useEffect, useState } from 'react'
import type { WorkerReportsSeedT } from '@/lib/kosztorys/types'

export type WorkerReportsActionT = {
  open: boolean
  setOpen: (open: boolean) => void
  // The report the dialog opens on; undefined opens the list.
  reportId: number | undefined
  openReport: (reportId?: number) => void
  pendingCount: number
  setPendingCount: (count: number) => void
}

export function useWorkerReportsAction(seed: WorkerReportsSeedT | undefined): WorkerReportsActionT {
  const deepLinkedId = seed?.openReportId
  const [open, setOpen] = useState(deepLinkedId !== undefined)
  const [reportId, setReportId] = useState(deepLinkedId)
  const [pendingCount, setPendingCount] = useState(seed?.pendingCount ?? 0)

  // Stripped once it has opened the dialog, so a reload after closing it does not reopen it. The
  // History API rather than `router.replace`: Next syncs it without re-rendering the page's server tree.
  useEffect(() => {
    if (deepLinkedId !== undefined) window.history.replaceState(null, '', window.location.pathname)
  }, [deepLinkedId])

  return {
    open,
    setOpen: (next) => {
      setOpen(next)
      if (!next) setReportId(undefined)
    },
    reportId,
    openReport: (next) => {
      setReportId(next)
      setOpen(true)
    },
    pendingCount,
    setPendingCount,
  }
}
