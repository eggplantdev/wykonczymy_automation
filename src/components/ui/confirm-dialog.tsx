'use client'

import { type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

type PropsT = {
  open: boolean
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  // A confirm step exists because the action is hard to take back, so red is the default. `neutral`
  // is the opt-out for the handful whose confirm only asks „na pewno?" about something reversible.
  variant?: 'alert' | 'neutral'
  onConfirm: () => void
  // Fired on every close — Cancel, Escape, overlay click, AND right after `onConfirm`, because the
  // confirm button closes the dialog through the same `onOpenChange(false)`. Keep it to closing.
  onCancel: () => void
}

// Controlled confirm dialog: the app-styled replacement for window.confirm.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  variant = 'alert',
  onConfirm,
  onCancel,
}: PropsT) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <div className="flex flex-col gap-2">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description != null && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={variant === 'alert' ? buttonVariants({ variant: 'destructive' }) : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
