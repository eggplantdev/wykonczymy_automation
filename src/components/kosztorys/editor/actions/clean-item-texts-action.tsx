'use client'

import { useState } from 'react'
import { SpellCheck } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { cleanItemTextsAction } from '@/lib/actions/kosztorys'
import { toastMessage } from '@/lib/utils/toast'

// The one action with no dialog, so its state stays inside the item instead of being lifted.
export function CleanItemTextsMenuItem() {
  const { investmentId, onTreeReplaced } = useKosztorysEditorContext()
  const [cleaning, setCleaning] = useState(false)

  // Rewrites every opis and j.m. in place, so the grid reseeds off the revision token — the same
  // signal the sheet compare uses after it writes.
  function handleCleanItemTexts() {
    setCleaning(true)
    void cleanItemTextsAction(investmentId)
      .then((res) => {
        if (!res.success) return toastMessage(res.error, 'error')
        if (res.data === 0) return toastMessage('Nie znaleziono nic do poprawienia', 'info')
        toastMessage(`Poprawiono pozycje: ${res.data}`, 'success')
        onTreeReplaced?.()
      })
      .catch(() => toastMessage('Nie udało się poprawić pozycji', 'error'))
      .finally(() => setCleaning(false))
  }

  return (
    <DropdownMenuItem onSelect={handleCleanItemTexts} disabled={cleaning}>
      <SpellCheck />
      <MenuItemBody
        label="Popraw literówki w opisie prac i j.m."
        description="Poprawia literówki, zbędne spacje i wielkie litery w opisach, a j.m. ujednolica do zapisu z listy (m², szt, mb, kpl, pkt)."
      />
    </DropdownMenuItem>
  )
}
