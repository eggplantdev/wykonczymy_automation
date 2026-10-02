'use client'

import { useEffect, useState } from 'react'
import type { TranslationLanguageT } from '@/lib/i18n/languages'
import { getSectionTranslationForName } from '@/lib/queries/section-translation-for-name'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać tłumaczenia sekcji'

// Fetch-on-open, as `useCatalogueSavePreview`: the dialog is opened from a band menu, so `open` is the
// seam, and a failed load closes it — editing blind would overwrite an entry nobody saw.
export function useSectionTranslationOnOpen(
  sectionName: string,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const [loaded, setLoaded] = useState<Record<TranslationLanguageT, string> | null>(null)

  useEffect(() => {
    if (!open) return
    let stale = false
    void getSectionTranslationForName(sectionName)
      .then((translations) => {
        if (!stale) setLoaded(translations)
      })
      .catch(() => {
        if (stale) return
        toastMessage(LOAD_FAILED, 'error', 4000)
        onOpenChange(false)
      })
    return () => {
      stale = true
    }
  }, [open, sectionName, onOpenChange])

  return loaded
}
