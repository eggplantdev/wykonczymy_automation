'use client'

import { Languages } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useTreeRewriteAction } from '@/components/kosztorys/editor/actions/use-tree-rewrite-action'
import { fillKosztorysTranslationsAction } from '@/lib/actions/kosztorys-translations'
import { NOTICE_MS, translationFillNotice } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'

export function FillTranslationsMenuItem() {
  const { pending, start } = useTreeRewriteAction(
    fillKosztorysTranslationsAction,
    'Nie udało się uzupełnić tłumaczeń',
    (data) => {
      const { message, kind } = translationFillNotice(data)
      toastMessage(message, kind, NOTICE_MS)
      return data.items > 0
    },
  )

  function handleFill() {
    // The menu closes on select, so the wait — up to a minute on a long kosztorys — needs its own word.
    toastMessage('Tłumaczę opisy i nazwy sekcji…', 'info', NOTICE_MS)
    start()
  }

  return (
    <DropdownMenuItem onSelect={handleFill} disabled={pending}>
      <Languages />
      <MenuItemBody
        label="Uzupełnij tłumaczenia (AI)"
        description="Tłumaczy brakujące i nieaktualne opisy prac oraz nazwy sekcji na języki pracowników. Ręcznie wpisane, aktualne tłumaczenia zostają bez zmian."
      />
    </DropdownMenuItem>
  )
}
