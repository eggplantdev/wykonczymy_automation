'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
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
  const keepOpen = useOptimisticFormStore((s) => s.keepOpen)
  const isOpen = useOptimisticFormStore((s) => s.openFormId === formId)
  const isPending = useOptimisticFormStore(
    (s) => s.submission?.formId === formId && s.submission.status === 'pending',
  )
  const openDialog = useOptimisticFormStore((s) => s.openDialog)
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)

  function handleOpenChange(open: boolean) {
    if (open) {
      if (isPending) return
      openDialog(formId, showKeepOpen)
    } else {
      closeDialog()
    }
  }

  function handleSuccess() {
    if (!keepOpen) closeDialog()
  }

  return (
    <>
      <span onClick={() => !isPending && openDialog(formId, showKeepOpen)}>{trigger}</span>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className={className}>
          <div className="h-auto">
            <DialogHeader title={title} description={description} />
            <div className="mt-6 pr-1">{children(handleSuccess, keepOpen)}</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
