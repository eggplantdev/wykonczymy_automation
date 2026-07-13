'use client'

import { SubmitPill } from '@/components/forms/submit-pill'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

// On the optimistic submit path the dialog closes instantly and the upload + server action run
// fire-and-forget, so nothing else on screen signals a save is in progress. This renders the
// store's already-tracked `pending` flag; the store is shared by every optimistic form, so one
// mount covers all of them.
export function PendingSubmitIndicator() {
  const isPending = useOptimisticFormStore((s) => s.submission?.status === 'pending')

  if (!isPending) return null

  return <SubmitPill label="Zapisywanie…" />
}
