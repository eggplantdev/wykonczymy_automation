'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileInput } from '@/components/ui/file-input'
import { Upload } from 'lucide-react'
import { updateTransferInvoiceAction } from '@/lib/actions/transfers'
import { uploadFileClient } from '@/lib/upload-file-client'
import { toastMessage } from '@/lib/utils/toast'

type InvoiceUploadDialogPropsT = {
  transactionId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  isReplace?: boolean
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
    try {
      const mediaId = await uploadFileClient(file)
      const result = await updateTransferInvoiceAction(transactionId, mediaId)

      if (result.success) {
        toastMessage(isReplace ? 'Faktura zamieniona' : 'Faktura dodana', 'success')
        onOpenChange(false)
      } else {
        toastMessage(result.error, 'error')
      }
    } catch {
      toastMessage('Nie udało się przesłać pliku', 'error')
    } finally {
      setIsSubmitting(false)
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
            {isSubmitting ? 'Przesyłanie...' : 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
