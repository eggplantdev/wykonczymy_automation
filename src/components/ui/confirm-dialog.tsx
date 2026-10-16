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
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  open: boolean
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'alert' | 'neutral'
  onConfirm: () => void
  // Fired on every close — Cancel, Escape, overlay click, AND right after `onConfirm`, because the
  // confirm button closes the dialog through the same `onOpenChange(false)`. Keep it to closing.
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potwierdź',
  cancelLabel,
  variant = 'alert',
  onConfirm,
  onCancel,
}: PropsT) {
  const { t } = useTranslation('common')
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <div className="flex max-w-sm flex-col gap-2">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* A div, not Radix's <p>: a description may carry a list. */}
          {description != null && (
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2 *:max-sm:grow">
          <AlertDialogCancel>{cancelLabel ?? t('cancel')}</AlertDialogCancel>
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
