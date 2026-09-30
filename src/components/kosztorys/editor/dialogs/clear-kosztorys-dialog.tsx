'use client'

import { useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { clearKosztorysAction } from '@/lib/actions/kosztorys'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { toastMessage } from '@/lib/utils/toast'
import { itemNoun, sectionNoun } from '@/lib/kosztorys/counted-nouns'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

// The one action in „Opcje" that leaves nothing behind, so it states the counts it is about to
// delete rather than asking „na pewno?" over an unnamed amount.
export function ClearKosztorysDialog() {
  const { tree, investmentId, onTreeReplaced, isTemplate, noun } = useKosztorysEditorContext()
  const { open, setOpen: onOpenChange } = useKosztorysActions().clear
  const [pending, startTransition] = useTransition()

  const sections = tree.sections.length
  const items = tree.sections.reduce((total, section) => total + section.items.length, 0)

  function handleConfirm() {
    startTransition(async () => {
      const replaced = await settleTreeReplace(
        () => clearKosztorysAction(investmentId),
        `Czyszczenie przerwane — odświeżam ${noun.nominative}`,
        () => toastMessage(`${noun.Nominative} wyczyszczony`, 'success'),
      )
      if (!replaced) return
      onOpenChange(false)
      onTreeReplaced?.(replaced)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader
          title={`Wyczyść ${noun.nominative}`}
          // Etapy, wykonanie, VAT and the global rabat are matters of one job — a szablon carries
          // none of them, so there the sentence about them is not shorter, it is false.
          description={
            !isTemplate
              ? 'Cała rozpiska zniknie — razem z etapami i wpisanym wykonaniem. Stawka VAT i współczynniki zostają, rabat globalny zostanie wyzerowany (przywrócenie stanu go nie cofa). Stan sprzed wyczyszczenia zapisze się automatycznie — wrócisz do niego przez „Wczytaj”.'
              : 'Cała rozpiska zniknie. Stan sprzed wyczyszczenia zapisze się automatycznie — wrócisz do niego przez „Wczytaj”.'
          }
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
