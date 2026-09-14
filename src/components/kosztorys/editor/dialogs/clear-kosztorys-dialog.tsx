'use client'

import { useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { clearKosztorysAction } from '@/lib/actions/kosztorys'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { toastMessage } from '@/lib/utils/toast'
import { itemNoun, sectionNoun } from '@/lib/kosztorys/counted-nouns'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

// The one action in „Opcje" that leaves nothing behind, so it states the counts it is about to
// delete rather than asking „na pewno?" over an unnamed amount.
export function ClearKosztorysDialog() {
  const { tree, investmentId, onTreeReplaced } = useKosztorysEditorContext()
  const { open, setOpen: onOpenChange } = useKosztorysActions().clear
  const [pending, startTransition] = useTransition()

  const sections = tree.sections.length
  const items = tree.sections.reduce((total, section) => total + section.items.length, 0)

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await clearKosztorysAction(investmentId)
        if (!result.success) {
          toastMessage(result.error, 'error', 6000)
          return
        }
        toastMessage('Kosztorys wyczyszczony', 'success')
      } catch {
        // A transport-level rejection can arrive AFTER the transaction committed, so the grid may
        // already be rendering rows that no longer exist. Refreshing regardless is the safe read.
        toastMessage('Czyszczenie przerwane — odświeżam kosztorys', 'error', 6000)
      }
      onOpenChange(false)
      onTreeReplaced?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader
          title="Wyczyść kosztorys"
          description="Cała rozpiska zniknie — razem z etapami i wpisanym wykonaniem. Stawka VAT i współczynniki zostają, rabat globalny zostanie wyzerowany (przywrócenie stanu go nie cofa). Stan sprzed wyczyszczenia zapisze się automatycznie — wrócisz do niego przez „Wczytaj”."
        />

        <p className="text-muted-foreground text-sm">
          Do usunięcia: {sections} {sectionNoun(sections)} · {items} {itemNoun(items)}
        </p>

        <DialogActions
          confirmLabel="Wyczyść"
          confirmVariant="destructive"
          pending={pending}
          pendingLabel="Czyszczę…"
          onConfirm={handleConfirm}
          onCancel={() => onOpenChange(false)}
          // Clearing an already-empty rozpiska would only push an empty restore point into „Wersje".
          confirmDisabled={sections === 0 && items === 0}
        />
      </DialogContent>
    </Dialog>
  )
}
