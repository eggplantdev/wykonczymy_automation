'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { FileInput } from '@/components/ui/file-input'

type InvoiceUploadDialogPropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiles: (files: File[]) => void
}

/**
 * The pick IS the confirmation — no „Zapisz" step. The dialog exists only to give the drop target
 * room the table cell cannot spare, so it closes the moment it has files and hands the upload back
 * to the cell, which owns the pending state.
 */
export function InvoiceUploadDialog({ open, onOpenChange, onFiles }: InvoiceUploadDialogPropsT) {
  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])]
    if (picked.length === 0) return

    onOpenChange(false)
    onFiles(picked)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader title="Dodaj fakturę" />
        <FileInput multiple onChange={handlePicked} className="h-28 flex-col" />
      </DialogContent>
    </Dialog>
  )
}
