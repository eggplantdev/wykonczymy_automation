'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ConfirmCloseDialog } from '@/components/ui/confirm-close-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

type FormDialogPropsT = {
  formId: string
  trigger: React.ReactNode
  title: string
  description?: string
  showKeepOpen?: boolean
  children: (onSuccess: () => void, keepOpen: boolean) => React.ReactNode
}

export function FormDialog({
  formId,
  trigger,
  title,
  description,
  showKeepOpen = true,
  children,
}: FormDialogPropsT) {
  const [keepOpen, setKeepOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isOpen = useOptimisticFormStore((s) => s.openFormId === formId)
  const openDialog = useOptimisticFormStore((s) => s.openDialog)
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  function handleOpenChange(open: boolean) {
    if (open) {
      openDialog(formId)
    } else {
      closeDialog()
      clearSubmission()
    }
  }

  function handleSuccess() {
    if (!keepOpen) closeDialog()
  }

  return (
    <>
      <span onClick={() => openDialog(formId)}>{trigger}</span>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="h-fit max-h-[80vh] sm:max-w-2xl"
          onInteractOutside={(e) => {
            e.preventDefault()
            setShowConfirm(true)
          }}
        >
          <div className="h-auto">
            <DialogHeader title={title} description={description} />
            <div className="mt-2 pr-1">{children(handleSuccess, keepOpen)}</div>
            {showKeepOpen && (
              <label className="flex cursor-pointer items-center gap-2 py-4 text-sm select-none">
                <Checkbox
                  checked={keepOpen}
                  onCheckedChange={(checked) => setKeepOpen(checked === true)}
                />
                Nie zamykaj po zapisaniu
              </label>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmCloseDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={() => handleOpenChange(false)}
      />
    </>
  )
}
