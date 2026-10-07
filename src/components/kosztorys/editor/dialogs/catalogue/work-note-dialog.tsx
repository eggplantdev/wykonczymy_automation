'use client'

import { useState } from 'react'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Textarea } from '@/components/ui/textarea'
import { updateCatalogueNoteAction } from '@/lib/actions/work-catalogue'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { RowCatalogueEntryT } from '@/lib/kosztorys/work-catalogue/catalogue-entry-by-row'

export function WorkNoteDialog({
  entry,
  onOpenChange,
}: {
  entry: RowCatalogueEntryT
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState(entry.note ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    const res = await settleAction(() => updateCatalogueNoteAction(entry.id, text))
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać komentarza', 'error', 4000)
      return
    }
    toastMessage('Zapisano komentarz do pracy', 'success')
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open
      onOpenChange={onOpenChange}
      title="Komentarz do pracy…"
      description="Wiedza firmowa, niewidoczna dla klienta. Dotyczy tej pracy w każdym kosztorysie i szablonie — zapisuje się w katalogu prac. Kolumna „Komentarz” zostaje przypisana do jednego kosztorysu."
      confirmLabel="Zapisz"
      onConfirm={handleSave}
      confirmDisabled={saving}
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
