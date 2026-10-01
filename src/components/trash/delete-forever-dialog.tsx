'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { TRASH_KINDS } from '@/components/trash/trash-kinds'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { TrashRowT } from '@/types/trash'

type PropsT = {
  row: TrashRowT
  open: boolean
  onClose: () => void
}

export function DeleteForeverDialog({ row, open, onClose }: PropsT) {
  const copy = TRASH_KINDS[row.kind]
  const [typedName, setTypedName] = useState('')
  const [pending, startTransition] = useTransition()

  const close = () => {
    setTypedName('')
    onClose()
  }

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => copy.deleteForever(row.id, typedName))
      if (!res.success) return toastMessage(res.error ?? copy.failed, 'error')
      toastMessage(copy.deleted, 'success')
      close()
    })
  }

  const nameMatches = typedName.trim() === row.name.trim()

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Usunąć na zawsze?"
      description={[
        copy.note?.(row),
        copy.lost
          ? `„${row.name}" zniknie bezpowrotnie, razem z: ${copy.lost}.`
          : `„${row.name}" zniknie bezpowrotnie.`,
        'Wpisz nazwę, żeby potwierdzić.',
      ]
        .filter(Boolean)
        .join(' ')}
      confirmLabel="Usuń na zawsze"
      onConfirm={onConfirm}
      confirmDisabled={!nameMatches}
      pending={pending}
      pendingLabel="Usuwam…"
    >
      <Input
        value={typedName}
        onChange={(event) => setTypedName(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && nameMatches && !pending && onConfirm()}
        aria-label={copy.nameLabel}
        autoFocus
      />
    </FormDialogShell>
  )
}
