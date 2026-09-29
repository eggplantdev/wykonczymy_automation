'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'

/**
 * The frame both sheet windows sit in. Shared for the two sentences it owns rather than for the
 * markup: „Czytam arkusz Google…" and the refusal are the only thing the owner sees when a read is
 * slow or a sheet is unreachable, and written twice they would have drifted into two different
 * accounts of the same failure.
 *
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
  // Why the read produced nothing. Rendered here rather than toasted: a refusal the owner has to act
  // on („udostępnij arkusz", „powiąż arkusz w ustawieniach") outlives a toast, and the window is
  // already open saying the read failed.
  error: string | null
  // The wait line. Defaulted rather than required because the sheet windows are what this frame was
  // written for; a report reading something else must say what it is reading.
  loadingText?: string
  actions?: ReactNode
  children: (data: DataT) => ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wide because every row here is „długi opis pracy" against three or four figure columns —
          narrower, the opis wraps to three lines and the numbers it is about drift off its own row. */}
      <DialogContent className="sm:max-w-dialog-xl">
        <DialogHeader title={title} description={description} />

        {!loaded ? (
          <p className="text-muted-foreground text-sm">{loadingText}</p>
        ) : !data ? (
          <p className="text-destructive text-sm">
            {error ?? 'Nie udało się odczytać arkusza Google.'}
          </p>
        ) : (
          <div className="space-y-5 text-sm">{children(data)}</div>
        )}

        {actions}
      </DialogContent>
    </Dialog>
  )
}
