'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  deletePresetAction,
  openPresetInWorkshopAction,
  renamePresetAction,
} from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'
import type { PresetRowT } from '@/components/tables/presets'

export function PresetRowActions({ preset }: { preset: PresetRowT }) {
  const router = useRouter()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(preset.name)
  const [pending, startTransition] = useTransition()

  // The load happens here rather than on the target page: it is a write, and a page render is not
  // allowed to perform one. The url carries the SZABLON's id — the workbench investment behind it is
  // never named to the user.
  const onOpen = () => {
    startTransition(async () => {
      const res = await openPresetInWorkshopAction(preset.id)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się otworzyć szablonu', 'error')
      router.push(`/szablony/${preset.id}`)
    })
  }

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
      <SimpleTooltip content="Otwórz szablon">
        <Button
          size="xs"
          variant="ghost"
          className="px-1.5"
          aria-label="Otwórz szablon"
          disabled={pending}
          onClick={onOpen}
        >
          <FolderOpen />
        </Button>
      </SimpleTooltip>

      <SimpleTooltip content="Zmień nazwę">
        <Button
          size="xs"
          variant="ghost"
          className="px-1.5"
          aria-label="Zmień nazwę szablonu"
          onClick={() => {
            setDraftName(preset.name)
            setRenaming(true)
          }}
        >
          <Pencil />
        </Button>
      </SimpleTooltip>

      <SimpleTooltip content="Usuń szablon">
        <Button
          size="xs"
          variant="ghostDestructive"
          className="px-1.5"
          aria-label="Usuń szablon"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 />
        </Button>
      </SimpleTooltip>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmień nazwę szablonu</DialogTitle>
            <DialogDescription>
              Nazwa jest tożsamością szablonu — pod nią widać go w każdym wyborze szablonu.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !pending && onRename()}
            aria-label="Nazwa szablonu"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)} disabled={pending}>
              Anuluj
            </Button>
            <Button onClick={onRename} disabled={pending || draftName.trim().length === 0}>
              {pending ? 'Zapisuję…' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
