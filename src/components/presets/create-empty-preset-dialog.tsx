'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { useOpenPreset } from '@/components/presets/use-open-preset'
import { createEmptyPresetAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'

// The other way into the warsztat: a szablon built from nothing rather than copied from a kosztorys.
// It goes straight there on success, because an empty szablon sitting on the list is worth nothing
// until someone puts a sekcja in it.
export function CreateEmptyPresetDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const { open: openInWorkshop } = useOpenPreset()

  const onConfirm = () => {
    startTransition(async () => {
      const res = await createEmptyPresetAction(name)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się założyć szablonu', 'error')
      // Before the navigation, never after: `open` pushes a new route, and a dialog still mounted
      // when the page under it is torn down stays on screen over the warsztat.
      setOpen(false)
      setName('')
      openInWorkshop(res.data.id)
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Nowy szablon
      </Button>

      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Nowy szablon"
        description="Zakłada pusty szablon i otwiera go w warsztacie, gdzie dokładasz sekcje i prace."
        confirmLabel="Załóż"
        onConfirm={onConfirm}
        confirmDisabled={name.trim().length === 0}
        pending={pending}
        pendingLabel="Zakładam…"
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !pending && onConfirm()}
          aria-label="Nazwa szablonu"
          autoFocus
        />
      </FormDialogShell>
    </>
  )
}
