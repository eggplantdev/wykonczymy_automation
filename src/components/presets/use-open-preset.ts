'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { openPresetInWorkshopAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'

// Opening a szablon is a WRITE — it loads the szablon into the shared warsztat — so it happens on a
// click, never as a side effect of rendering /szablony/[id]. Both entry points (the list row and the
// prompt the page shows when the warsztat holds something else) land on the same url afterwards,
// with a refresh, because the page's own render is what proves the warsztat now holds this szablon.
export function useOpenPreset(presetId: number): { open: () => void; pending: boolean } {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const open = () => {
    startTransition(async () => {
      const res = await openPresetInWorkshopAction(presetId)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się otworzyć szablonu', 'error')
      router.push(`/szablony/${presetId}`)
      router.refresh()
    })
  }

  return { open, pending }
}
