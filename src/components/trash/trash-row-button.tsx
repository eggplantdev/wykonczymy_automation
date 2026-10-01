'use client'

import { useState, startTransition } from 'react'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

type PropsT = {
  label: string
  description: string
  trash: () => Promise<ActionResultT>
  trashed: string
  failed: string
}

// Never pre-disabled: where a kind refuses, the refusal names what uses the row, which a disabled
// button could not say.
export function TrashRowButton({ label, description, trash, trashed, failed }: PropsT) {
  const [confirming, setConfirming] = useState(false)

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(trash)
      setConfirming(false)
      if (!res.success) return toastMessage(res.error ?? failed, 'error')
      toastMessage(trashed, 'success')
    })
  }

  return (
    <>
      <DeleteButton label={label} onClick={() => setConfirming(true)} />
      <ConfirmDialog
        open={confirming}
        title="Przenieść do kosza?"
        description={description}
        confirmLabel="Przenieś do kosza"
        variant="neutral"
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
