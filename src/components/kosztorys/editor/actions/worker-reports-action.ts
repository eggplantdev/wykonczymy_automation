'use client'

import { useState } from 'react'
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

  return {
    open,
    setOpen: (next) => {
      setOpen(next)
      if (next) return
      setReportId(undefined)
      stripDeepLink()
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

// So a reload after closing does not reopen the report. Not on mount: Next answers a replaceState
// with a router restore, and a restore discards every server action still in flight — the dialog's
// list read among them, which then never settles. The History API rather than `router.replace`,
// which would re-render the page's server tree.
function stripDeepLink() {
  if (new URLSearchParams(window.location.search).has('zgloszenie')) {
    window.history.replaceState(null, '', window.location.pathname)
  }
}
