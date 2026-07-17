'use client'

import { useState } from 'react'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { saveSnapshotAction } from '@/lib/actions/kosztorys-snapshots'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

// "Zapisz wersję" — a named manual restore point. The field is prefilled with the current timestamp
// (editable) so a quick save-and-Enter still yields a sensible label, while typing a real name gives
// the entry a findable title in the "Wersje" list above the ambient auto history.
export function SaveVersionDialog({ investmentId, open, onOpenChange }: PropsT) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    // Reseed the timestamp default on each open, not on close (avoids a flash of the old value).
    if (next) {
      setName(new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }))
    }
  }

  const label = name.trim()
  const canSave = label.length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const res = await saveSnapshotAction(investmentId, label)
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać wersji', 'error', 4000)
      return
    }
    toastMessage('Zapisano wersję', 'success')
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Zapisz wersję"
      description="Nazwany punkt, do którego możesz wrócić."
      confirmLabel="Zapisz"
      onConfirm={() => void handleSave()}
      confirmDisabled={!canSave}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa wersji"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSave) void handleSave()
        }}
      />
    </FormDialogShell>
  )
}
