'use client'

import { SpellCheck } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import {
  useTreeRewriteAction,
  type TreeRewriteActionT,
} from '@/components/kosztorys/editor/actions/use-tree-rewrite-action'
import { cleanItemTextsAction } from '@/lib/actions/kosztorys'
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

export function CleanItemTextsMenuItem() {
  const { cleanItemTexts, treeRewriting } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={cleanItemTexts.start} disabled={treeRewriting}>
      <SpellCheck />
      <MenuItemBody
        label="Popraw literówki w opisie prac i j.m."
        description="Poprawia literówki, zbędne spacje i wielkie litery w opisach, a j.m. ujednolica do zapisu z listy (m², szt, mb, kpl, pkt)."
      />
    </DropdownMenuItem>
  )
}
