'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { openPresetInWorkshopAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'

// Opening a szablon is a WRITE (loads it into the shared warsztat), so it fires on click only —
// the list row isn't an <a> either, since DataTable prefetches a row href on hover. Both entry
// points refresh after navigating, since only the page's own render proves the write landed.
export function useOpenPreset(): { open: (presetId: number) => void; pendingId?: number } {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [requestedId, setRequestedId] = useState<number>()

  const open = (presetId: number) => {
    setRequestedId(presetId)
    startTransition(async () => {
      const res = await openPresetInWorkshopAction(presetId)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się otworzyć szablonu', 'error')
      router.push(`/szablony/${presetId}`)
      router.refresh()
    })
  }

  return { open, pendingId: pending ? requestedId : undefined }
}
