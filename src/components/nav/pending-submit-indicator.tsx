'use client'

import { SubmitPill } from '@/components/ui/submit-pill'
import { firstPendingLabel, usePendingStore } from '@/stores/pending-store'

export function PendingSubmitIndicator() {
  const label = usePendingStore((state) => firstPendingLabel(state.pending))

  if (!label) return null

  return <SubmitPill label={label} />
}
