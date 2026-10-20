'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  confirmDisabled?: boolean
  confirmVariant?: ComponentProps<typeof DialogActions>['confirmVariant']
  cancelLabel?: string
  showCloseButton?: boolean
  pending?: boolean
  pendingLabel?: string
  contentClassName?: string
}

export function FormDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  confirmVariant,
  cancelLabel,
  showCloseButton,
  pending,
  pendingLabel,
  contentClassName,
}: PropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn('sm:max-w-dialog-sm', contentClassName)}
      >
        <DialogHeader title={title} description={description} />
        {children}
        <DialogActions
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
          confirmDisabled={confirmDisabled}
          confirmVariant={confirmVariant}
          cancelLabel={cancelLabel}
          pending={pending}
          pendingLabel={pendingLabel}
        />
      </DialogContent>
    </Dialog>
  )
}
