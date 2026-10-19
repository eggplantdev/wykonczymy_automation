'use client'

import {
  useTreeRewriteAction,
  type TreeRewriteActionT,
} from '@/components/kosztorys/editor/actions/use-tree-rewrite-action'
import { cleanItemTextsAction } from '@/lib/actions/kosztorys-items'
import { toastMessage } from '@/lib/utils/toast'

export function useCleanItemTextsAction(): TreeRewriteActionT {
  return useTreeRewriteAction(cleanItemTextsAction, 'Nie udało się poprawić pozycji', (fixed) => {
    if (fixed === 0) {
      toastMessage('Nie znaleziono nic do poprawienia', 'info')
      return false
    }
    toastMessage(`Poprawiono pozycje: ${fixed}`, 'success')
    return true
  })
}
