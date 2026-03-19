'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RemoveButton } from '@/components/ui/remove-button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { cancelTransferAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/components/toasts'

type CancelTransferButtonPropsT = {
  transactionId: number
}

export function CancelTransferButton({ transactionId }: CancelTransferButtonPropsT) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleConfirm() {
    setIsPending(true)
    const result = await cancelTransferAction(transactionId)
    setIsPending(false)

    if (result.success) {
      toastMessage('Transakcja została anulowana', 'success')
      setOpen(false)
      router.refresh()
    } else {
      toastMessage(result.error, 'error')
    }
  }

  return (
    <>
      <RemoveButton onClick={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="h-fit sm:max-w-md">
          <DialogHeader
            title="Anulowanie transakcji"
            description={`Czy na pewno chcesz anulować transakcję #${transactionId}? Operacja jest nieodwracalna.`}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Nie
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Anulowanie...' : 'Tak, anuluj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
