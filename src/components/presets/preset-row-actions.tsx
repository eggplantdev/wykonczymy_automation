'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { deletePresetAction, renamePresetAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'
import type { PresetRowT } from '@/lib/queries/presets'

export function PresetRowActions({ preset }: { preset: PresetRowT }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(preset.name)
  const [pending, startTransition] = useTransition()

  const onDelete = () => {
    startTransition(async () => {
      const res = await deletePresetAction(preset.id)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć szablonu', 'error')
      toastMessage('Szablon usunięty.', 'success')
      setConfirmingDelete(false)
    })
  }

  const onRename = () => {
    startTransition(async () => {
      const res = await renamePresetAction(preset.id, draftName)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się zmienić nazwy', 'error')
      toastMessage('Nazwa zmieniona.', 'success')
      setRenaming(false)
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <EditButton
        label="Zmień nazwę szablonu"
        onClick={() => {
          setDraftName(preset.name)
          setRenaming(true)
        }}
      />

      <DeleteButton label="Usuń szablon" onClick={() => setConfirmingDelete(true)} />

      <FormDialogShell
        open={renaming}
        onOpenChange={setRenaming}
        title="Zmień nazwę szablonu"
        description="Nazwa jest tożsamością szablonu — pod nią widać go w każdym wyborze szablonu."
        confirmLabel="Zapisz"
        onConfirm={onRename}
        confirmDisabled={draftName.trim().length === 0}
        pending={pending}
        pendingLabel="Zapisuję…"
      >
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !pending && onRename()}
          aria-label="Nazwa szablonu"
          autoFocus
        />
      </FormDialogShell>

      <ConfirmDialog
        open={confirmingDelete}
        title="Usunąć szablon?"
        description={`„${preset.name}" zniknie z biblioteki bezpowrotnie. Kosztorysy założone z tego szablonu zostają bez zmian — mają własną kopię.`}
        confirmLabel="Usuń"
        pending={pending}
        pendingLabel="Usuwam…"
        onConfirm={onDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
