'use client'

import { useTransition } from 'react'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { toastMessage } from '@/lib/utils/toast'
import { itemNoun, sectionNoun } from '@/lib/kosztorys/counted-nouns'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function ClearKosztorysDialog() {
  const { tree, investmentId, onTreeReplaced, isTemplate, noun, flushPendingSaves } =
    useKosztorysEditorContext()
  const { open, setOpen: onOpenChange } = useKosztorysActions().clear
  const { clear } = useEditorActions()
  const [pending, startTransition] = useTransition()

  const sections = tree.sections.length
  const items = tree.sections.reduce((total, section) => total + section.items.length, 0)

  function handleConfirm() {
    startTransition(async () => {
      const replaced = await settleTreeReplace(
        flushPendingSaves,
        () => clear(investmentId),
        `Czyszczenie przerwane — odświeżam ${noun.nominative}`,
        () => toastMessage(`${noun.Nominative} wyczyszczony`, 'success'),
      )
      if (!replaced) return
      onOpenChange(false)
      onTreeReplaced?.(replaced)
    })
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="sm:max-w-dialog"
      title={`Wyczyść ${noun.nominative}`}
      description={
        !isTemplate
          ? 'Cała rozpiska zniknie — razem z etapami i wpisanym wykonaniem. Stawka VAT i współczynniki zostają, rabat globalny zostanie wyzerowany (przywrócenie stanu go nie cofa). Stan sprzed wyczyszczenia zapisze się automatycznie — wrócisz do niego przez „Wczytaj”.'
          : 'Cała rozpiska zniknie. Stan sprzed wyczyszczenia zapisze się automatycznie — wrócisz do niego przez „Wczytaj”.'
      }
      confirmLabel="Wyczyść"
      confirmVariant="destructive"
      pending={pending}
      pendingLabel="Czyszczę…"
      onConfirm={handleConfirm}
      // Clearing an already-empty rozpiska would only push an empty restore point into „Wersje".
      confirmDisabled={sections === 0 && items === 0}
    >
      <Description withIcon={false}>
        Do usunięcia: {sections} {sectionNoun(sections)} · {items} {itemNoun(items)}
      </Description>
    </FormDialogShell>
  )
}
