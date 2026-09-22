'use client'

import { useState } from 'react'

import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { FileInput } from '@/components/ui/file-input'

type InvoiceUploadDialogPropsT = {
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiles: (files: File[], asPlan: boolean) => void
  /** Offers the „to jest rzut" marker. Invoice surfaces omit it — a faktura is never a rysunek. */
  allowPlanMarker?: boolean
}

/**
 * The pick IS the confirmation — no „Zapisz" step. The dialog exists only to give the drop target
 * room the table cell cannot spare, so it closes the moment it has files and hands the upload back
 * to the cell, which owns the pending state.
 *
 * That is also why the marker is a checkbox ABOVE the picker rather than a question after it: there
 * is no moment after the pick at which to ask.
 */
export function InvoiceUploadDialog({
  title = 'Dodaj fakturę',
  open,
  onOpenChange,
  onFiles,
  allowPlanMarker = false,
}: InvoiceUploadDialogPropsT) {
  const [asPlan, setAsPlan] = useState(false)

  // The dialog stays mounted when Radix unmounts its content, so a tick left behind by a cancelled
  // pick would silently stamp the NEXT upload as a rzut.
  function handleOpenChange(next: boolean) {
    if (!next) setAsPlan(false)
    onOpenChange(next)
  }

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])]
    if (picked.length === 0) return

    handleOpenChange(false)
    onFiles(picked, asPlan)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader title={title} />
        {allowPlanMarker && (
          <CheckboxRow checked={asPlan} onCheckedChange={setAsPlan}>
            To jest rzut lub projekt
          </CheckboxRow>
        )}
        <FileInput multiple onChange={handlePicked} className="h-28 flex-col" />
      </DialogContent>
    </Dialog>
  )
}
