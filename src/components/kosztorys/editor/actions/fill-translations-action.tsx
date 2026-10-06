'use client'

import { Languages } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import {
  useTreeRewriteAction,
  type TreeRewriteActionT,
} from '@/components/kosztorys/editor/actions/use-tree-rewrite-action'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { countNeedingTranslation } from '@/lib/i18n/description-translations'
import { fillKosztorysTranslationsAction } from '@/lib/actions/kosztorys-translations'
import { NOTICE_MS, translationFillNotice } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'

export function useFillTranslationsAction(): TreeRewriteActionT {
  const { pending, start } = useTreeRewriteAction(
    fillKosztorysTranslationsAction,
    'Nie udało się uzupełnić tłumaczeń',
    (data) => {
      const { message, kind } = translationFillNotice(data)
      toastMessage(message, kind, NOTICE_MS)
      return data.items > 0
    },
  )

  function startWithNotice() {
    // The menu closes on select, so the wait — up to a minute on a long kosztorys — needs its own word.
    toastMessage('Tłumaczę opisy i nazwy sekcji…', 'info', NOTICE_MS)
    start()
  }

  return { pending, start: startWithNotice }
}

export function FillTranslationsMenuItem() {
  const { rows } = useKosztorysEditorContext()
  const { fillTranslations, treeRewriting } = useKosztorysActions()

  const count = countNeedingTranslation(rows)
  if (count === 0) return null

  return (
    <DropdownMenuItem onSelect={fillTranslations.start} disabled={treeRewriting}>
      <Languages />
      <MenuItemBody
        label={`Uzupełnij tłumaczenia (AI) · ${count}`}
        description="Tłumaczy brakujące i nieaktualne opisy prac oraz nazwy sekcji na języki pracowników. Ręcznie wpisane, aktualne tłumaczenia zostają bez zmian."
      />
    </DropdownMenuItem>
  )
}
