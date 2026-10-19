'use client'

import {
  useTreeRewriteAction,
  type TreeRewriteActionT,
} from '@/components/kosztorys/editor/actions/use-tree-rewrite-action'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
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
