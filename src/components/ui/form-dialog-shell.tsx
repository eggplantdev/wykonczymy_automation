'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  confirmDisabled?: boolean
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
  pending,
  pendingLabel,
  contentClassName,
}: PropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-sm', contentClassName)}>
        <DialogHeader title={title} description={description} />
        {children}
        <DialogActions
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
          confirmDisabled={confirmDisabled}
          pending={pending}
          pendingLabel={pendingLabel}
        />
      </DialogContent>
    </Dialog>
  )
}
