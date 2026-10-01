'use client'

import { useState, startTransition } from 'react'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { trashWorkerAction } from '@/lib/actions/worker-trash'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

function describeTrash(name: string, registerNames: string[]): string {
  const withRegisters =
    registerNames.length === 0
      ? ''
      : ` Razem z nim ${registerNames.length === 1 ? 'kasa' : 'kasy'}: ${registerNames.join(', ')}.`
  return `Przenieść „${name}" do kosza? Nie zaloguje się, dopóki go nie przywrócisz.${withRegisters}`
}

// Never pre-disabled for a used worker: the refusal names what uses him, which a disabled button
// could not say.
export function TrashWorkerButton({
  worker,
}: {
  worker: { id: number; name: string; registerNames: string[] }
}) {
  const [confirming, setConfirming] = useState(false)

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => trashWorkerAction(worker.id))
      setConfirming(false)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć pracownika', 'error')
      toastMessage('Pracownik przeniesiony do kosza.', 'success')
    })
  }

  return (
    <>
      <DeleteButton label="Usuń pracownika" onClick={() => setConfirming(true)} />
      <ConfirmDialog
        open={confirming}
        title="Przenieść do kosza?"
        description={describeTrash(worker.name, worker.registerNames)}
        confirmLabel="Przenieś do kosza"
        variant="neutral"
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
