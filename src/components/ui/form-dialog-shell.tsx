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

// Self-controlled (open/onOpenChange props, no optimistic store) shell for the standard kosztorys
// form dialog: header + body + an Anuluj/confirm footer. Not a god shell — the body is a free slot
// and edge-case dialogs (edge-to-edge cmdk, non-dismissible) stay on the raw primitives. Cancel and
// every dismiss route through onOpenChange(false), so the caller's close/reset logic runs once.
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
