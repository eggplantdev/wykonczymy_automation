'use client'

import { useState, useTransition } from 'react'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Textarea } from '@/components/ui/textarea'
import { updateCatalogueNoteAction } from '@/lib/actions/work-catalogue'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { RowCatalogueEntryT } from '@/lib/kosztorys/work-catalogue/types'

export function WorkNoteDialog({
  entry,
  onOpenChange,
}: {
  entry: RowCatalogueEntryT
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState(entry.note ?? '')
  const [pending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const res = await settleAction(() => updateCatalogueNoteAction(entry.id, text))
      if (!res.success) {
        toastMessage(res.error ?? 'Nie udało się zapisać komentarza', 'error', 4000)
        return
      }
      toastMessage('Zapisano komentarz do pracy', 'success')
      onOpenChange(false)
    })
  }

  return (
    <FormDialogShell
      open
      onOpenChange={onOpenChange}
      title="Komentarz do pracy…"
      description="Wiedza firmowa, niewidoczna dla klienta. Dotyczy tej pracy w każdym kosztorysie i szablonie — zapisuje się w katalogu prac. Kolumna „Komentarz” zostaje przypisana do jednego kosztorysu."
      confirmLabel="Zapisz"
      onConfirm={handleSave}
      pending={pending}
      pendingLabel="Zapisuję…"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Np. co wchodzi w zakres, czego agent ma nie pomijać…"
        rows={5}
        autoFocus
      />
    </FormDialogShell>
  )
}
