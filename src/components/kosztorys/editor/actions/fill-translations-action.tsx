'use client'

import { Languages } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import {
  useTreeRewriteAction,
  type TreeRewriteActionT,
} from '@/components/kosztorys/editor/actions/use-tree-rewrite-action'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { countNeedingTranslation } from '@/lib/i18n/description-translations'
import { NOTICE_MS, translationFillNotice } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'

export function useFillTranslationsAction(): TreeRewriteActionT {
  const { fillTranslations } = useEditorActions()
  const { pending, start } = useTreeRewriteAction(
    fillTranslations,
    'Nie udało się uzupełnić tłumaczeń',
    (data) => {
      const { message, kind } = translationFillNotice(data)
      toastMessage(message, kind, NOTICE_MS)
      return data.items > 0
    },
  )

  function startWithNotice() {
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
