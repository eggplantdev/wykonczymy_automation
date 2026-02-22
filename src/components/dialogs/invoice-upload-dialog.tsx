'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileInput } from '@/components/ui/file-input'
import { Upload } from 'lucide-react'
import { updateTransferInvoiceAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/components/toasts'

type InvoiceUploadDialogPropsT = {
  readonly transactionId: number
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly isReplace?: boolean
}

export function InvoiceUploadDialog({
  transactionId,
  open,
  onOpenChange,
  isReplace = false,
}: InvoiceUploadDialogPropsT) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toastMessage('Wybierz plik', 'error')
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.set('invoice', file)

    const result = await updateTransferInvoiceAction(transactionId, formData)

    setIsSubmitting(false)

    if (result.success) {
      toastMessage(isReplace ? 'Faktura zamieniona' : 'Faktura dodana', 'success')
      onOpenChange(false)
    } else {
      toastMessage(result.error, 'error')
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && fileRef.current) {
      fileRef.current.value = ''
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="h-fit sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2"
        aria-describedby={undefined}
      >
        <DialogHeader title={isReplace ? 'Zamień fakturę' : 'Dodaj fakturę'} />

        <FileInput ref={fileRef} accept="image/*,application/pdf" />

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            <Upload />
            {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
