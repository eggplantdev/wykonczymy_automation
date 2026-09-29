'use client'

import { useEffect, useState } from 'react'
import { catalogueSavePreview } from '@/lib/queries/catalogue-save-preview'
import type { CatalogueSavePreviewT } from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać danych pozycji'

// Fetch-on-open for the two dialogs that write a pozycja into the cennik — both are opened from the
// row menu, so `open` is the only reliable seam (see `use-list-on-open` for the same reasoning on a
// list). Unlike that hook, a failed load CLOSES the dialog: every figure these two show comes from the
// preview, so there is no degraded shape left to render.
export function useCatalogueSavePreview(
  itemId: number,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const [preview, setPreview] = useState<CatalogueSavePreviewT | null>(null)

  useEffect(() => {
    if (!open) return
    // A close-then-reopen mid-flight would otherwise resolve into the reset state, or toast at a
    // dialog nobody is looking at.
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      toastMessage(message, 'error', 4000)
      onOpenChange(false)
    }
    void catalogueSavePreview(itemId)
      .then((res) => {
        if (stale) return
        if (!res.success) return fail(res.error ?? LOAD_FAILED)
        setPreview(res.data)
      })
      // A transport-level RPC rejection never resolves to {success:false}.
      .catch(() => fail(LOAD_FAILED))
    return () => {
      stale = true
    }
  }, [open, itemId, onOpenChange])

  return preview
}
