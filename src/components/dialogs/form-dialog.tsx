'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

type FormDialogPropsT = {
  formId: string
  trigger: React.ReactNode
  title: string
  description?: string
  showKeepOpen?: boolean
  className?: string
  children: (onSubmitSuccess: () => void, keepOpen: boolean) => React.ReactNode
}

export function FormDialog({
  formId,
  trigger,
  title,
  description,
  showKeepOpen = true,
  className,
  children,
}: FormDialogPropsT) {
  const [keepOpen, setKeepOpen] = useState(false)
  const isOpen = useOptimisticFormStore((s) => s.openFormId === formId)
  const isPending = useOptimisticFormStore(
    (s) => s.submission?.formId === formId && s.submission.status === 'pending',
  )
  const openDialog = useOptimisticFormStore((s) => s.openDialog)
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)

  function handleOpenChange(open: boolean) {
    if (open) {
      if (isPending) return
      openDialog(formId)
    } else {
      closeDialog()
    }
  }

  function handleSuccess() {
    if (!keepOpen) closeDialog()
  }

  return (
    <>
      {isPending ? (
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="size-3.5 animate-spin" />
          Zapisywanie...
        </Button>
      ) : (
        <span onClick={() => openDialog(formId)}>{trigger}</span>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className={className}>
          <div className="h-auto">
            <DialogHeader title={title} description={description} />
            <div className="mt-4 pr-1">{children(handleSuccess, keepOpen)}</div>
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
    </>
  )
}
