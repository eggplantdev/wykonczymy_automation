'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ConfirmCloseDialogPropsT = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: () => void
  readonly title?: string
  readonly description?: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
}

export function ConfirmCloseDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Zamknąć formularz?',
  description = 'Niezapisane dane zostaną utracone.',
  confirmLabel = 'Zamknij',
  cancelLabel = 'Anuluj',
}: ConfirmCloseDialogPropsT) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
