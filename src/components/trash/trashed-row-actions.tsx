'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { DeleteForeverDialog } from '@/components/trash/delete-forever-dialog'
import { TRASH_KINDS } from '@/components/trash/trash-kinds'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { TrashRowT } from '@/types/trash'

export function TrashedRowActions({ row }: { row: TrashRowT }) {
  const kind = TRASH_KINDS[row.kind]
  const [deleting, setDeleting] = useState(false)
  const [pending, startTransition] = useTransition()

  const onRestore = () => {
    startTransition(async () => {
      const res = await settleAction(() => kind.restore(row.id))
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się przywrócić', 'error')
      toastMessage(kind.restored, 'success')
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <RowActionButton
        icon={RotateCcw}
        label={`Przywróć „${row.name}"`}
        text="Przywróć"
        showLabel
        disabled={pending}
        onClick={onRestore}
      />
      <DeleteButton
        label={`Usuń „${row.name}" na zawsze`}
        text="Usuń na zawsze"
        showLabel
        disabled={pending}
        onClick={() => setDeleting(true)}
      />
      <DeleteForeverDialog row={row} open={deleting} onClose={() => setDeleting(false)} />
    </div>
  )
}
