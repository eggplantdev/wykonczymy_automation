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

type PropsT = {
  open: boolean
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  // Disables both buttons and swaps the confirm label for `pendingLabel` while an async
  // confirm is in flight.
  pending?: boolean
  pendingLabel?: string
  onConfirm: () => void
  // Fired on Cancel, Escape, or overlay click — anything that dismisses without confirming.
  onCancel: () => void
}

// Controlled confirm dialog: the app-styled replacement for window.confirm.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  pending = false,
  pendingLabel,
  onConfirm,
  onCancel,
}: PropsT) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description != null && <AlertDialogDescription>{description}</AlertDialogDescription>}
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
