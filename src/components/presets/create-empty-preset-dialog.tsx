'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AddButton } from '@/components/ui/add-button'
import { Input } from '@/components/ui/input'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { createEmptyPresetAction } from '@/lib/actions/kosztorys-presets'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

export function CreateEmptyPresetDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const canSave = name.trim().length > 0 && !pending

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => createEmptyPresetAction(name))
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się założyć szablonu', 'error')
      // Before the navigation, never after: a dialog still mounted when the page under it is torn
      // down stays on screen over the szablon.
      setOpen(false)
      setName('')
      router.push(`/szablony/${res.data.id}`)
    })
  }

  return (
    <>
      <AddButton onClick={() => setOpen(true)}>Nowy szablon</AddButton>

      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Nowy szablon"
        description="Zakłada pusty szablon i otwiera go — dokładasz w nim sekcje i prace."
        confirmLabel="Załóż"
        onConfirm={onConfirm}
        confirmDisabled={!canSave}
        pending={pending}
        pendingLabel="Zakładam…"
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && canSave && onConfirm()}
          aria-label="Nazwa szablonu"
          autoFocus
        />
      </FormDialogShell>
    </>
  )
}
