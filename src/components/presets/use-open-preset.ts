'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { openPresetInWorkshopAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'

// Opening a szablon is a WRITE — it loads the szablon into the shared warsztat — so it happens on a
// click, never as a side effect of rendering /szablony/[id]. That is also why the list row is not an
// <a>: DataTable prefetches a row href on hover, which would fire the write on a mouse passing by.
// Both entry points (the list row and the prompt the page shows when the warsztat holds something
// else) land on the same url afterwards, with a refresh, because the page's own render is what
// proves the warsztat now holds this szablon.
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
