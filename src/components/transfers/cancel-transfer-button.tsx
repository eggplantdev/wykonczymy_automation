'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RemoveButton } from '@/components/ui/remove-button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cancelTransferAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/components/toasts'

const REASON_MIN_LENGTH = 10
const REASON_MAX_LENGTH = 500

type CancelTransferButtonPropsT = {
  transactionId: number
}

export function CancelTransferButton({ transactionId }: CancelTransferButtonPropsT) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const trimmedReason = reason.trim()
  const isReasonValid = trimmedReason.length >= REASON_MIN_LENGTH
  const remainingMin = Math.max(0, REASON_MIN_LENGTH - trimmedReason.length)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setReason('')
  }

  async function handleConfirm() {
    if (!isReasonValid) return
    setIsPending(true)
    const result = await cancelTransferAction(transactionId, { reason: trimmedReason })
    setIsPending(false)

    if (result.success) {
      toastMessage('Transakcja została anulowana', 'success')
      handleOpenChange(false)
      router.refresh()
    } else {
      toastMessage(result.error, 'error')
    }
  }

  return (
    <>
      <RemoveButton onClick={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="h-fit sm:max-w-md">
          <DialogHeader
            title="Anulowanie transakcji"
            description={`Czy na pewno chcesz anulować transakcję #${transactionId}? Operacja jest nieodwracalna.`}
          />

          <div className="grid gap-2">
            <Label htmlFor="cancel-reason">Powód anulowania (wymagany)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX_LENGTH))}
              placeholder={`Min. ${REASON_MIN_LENGTH} znaków`}
              rows={3}
              disabled={isPending}
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              {isReasonValid
                ? `${trimmedReason.length}/${REASON_MAX_LENGTH} znaków`
                : `Brakuje ${remainingMin} znaków`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Nie
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending || !isReasonValid}
            >
              {isPending ? 'Anulowanie...' : 'Tak, anuluj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
