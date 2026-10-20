'use client'

import type { ReactNode } from 'react'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { InlineLoading } from '@/components/ui/inline-loading'

/**
 * `data` renders through a callback because the blocks below read it unconditionally — passed as
 * plain children they would be built before the null check that guards them.
 */
export function SheetReportDialog<DataT>({
  open,
  onOpenChange,
  title,
  description,
  loaded,
  data,
  error,
  loadingText = 'Czytam arkusz Google…',
  actions,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  loaded: boolean
  data: DataT | null
  error: string | null
  loadingText?: string
  actions?: ReactNode
  children: (data: DataT) => ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-xl">
        <DialogHeader title={title} description={description} />

        {!loaded ? (
          <InlineLoading label={loadingText} />
        ) : !data ? (
          <Description tone="error" withIcon={false}>
            {error ?? 'Nie udało się odczytać arkusza Google.'}
          </Description>
        ) : (
          <div className="space-y-5 text-sm">{children(data)}</div>
        )}

        {actions}
      </DialogContent>
    </Dialog>
  )
}
