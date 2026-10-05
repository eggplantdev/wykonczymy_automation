'use client'

import { useState } from 'react'
import { Languages } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { fillKosztorysTranslationsAction } from '@/lib/actions/kosztorys-translations'
import { NOTICE_MS, translationFillNotice } from '@/lib/utils/notice'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

export function FillTranslationsMenuItem() {
  const { investmentId, onTreeReplaced } = useKosztorysEditorContext()
  const [filling, setFilling] = useState(false)

  // The grid reseeds off the revision token the writer bumps, as after „Popraw literówki".
  function handleFill() {
    setFilling(true)
    // The menu closes on select, so the wait — up to a minute on a long kosztorys — needs its own word.
    toastMessage('Tłumaczę opisy i nazwy sekcji…', 'info', NOTICE_MS)
    void settleAction(() => fillKosztorysTranslationsAction(investmentId))
      .then((res) => {
        if (!res.success && res.code === 'REQUEST_FAILED') {
          toastMessage('Nie udało się uzupełnić tłumaczeń — odświeżam kosztorys', 'error')
          return onTreeReplaced?.({ refetch: true })
        }
        if (!res.success) return toastMessage(res.error, 'error')
        const { message, kind } = translationFillNotice(res.data)
        toastMessage(message, kind, NOTICE_MS)
        if (res.data.items > 0) onTreeReplaced?.()
      })
      .finally(() => setFilling(false))
  }

  return (
    <DropdownMenuItem onSelect={handleFill} disabled={filling}>
      <Languages />
      <MenuItemBody
        label="Uzupełnij tłumaczenia (AI)"
        description="Tłumaczy brakujące i nieaktualne opisy prac oraz nazwy sekcji na języki pracowników. Ręcznie wpisane, aktualne tłumaczenia zostają bez zmian."
      />
    </DropdownMenuItem>
  )
}
