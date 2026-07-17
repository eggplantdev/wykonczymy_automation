'use client'

import { SubmitPill } from '@/components/forms/submit-pill'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

// Optimistic submit closes the dialog and runs the save fire-and-forget, so nothing else signals
// it's in progress. Mounted once; the shared store's `pending` flag covers every form.
export function PendingSubmitIndicator() {
  const isPending = useOptimisticFormStore((s) => s.submission?.status === 'pending')

  if (!isPending) return null

  return <SubmitPill label="Zapisywanie…" />
}
