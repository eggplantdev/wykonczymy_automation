'use client'

import { useState } from 'react'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { GridEventBoundary } from '@/components/ui/datasheet-grid/grid-event-boundary'
import { RESIZE_MIN_PX } from '@/components/ui/datasheet-grid/column-resize-handle'
import { parseColumnWidth } from '@/lib/kosztorys/parse-column-width'

type PropsT = {
  ids: string[]
  widths: Record<string, number>
  onApply: (width: number) => void
  onClose: () => void
}

function sharedWidth(ids: string[], widths: Record<string, number>): string {
  const first = widths[ids[0] ?? '']
  return first != null && ids.every((id) => widths[id] === first) ? String(first) : ''
}

export function ColumnWidthDialog({ ids, widths, onApply, onClose }: PropsT) {
  const [value, setValue] = useState(() => sharedWidth(ids, widths))
  const width = parseColumnWidth(value, RESIZE_MIN_PX)

  function apply() {
    if (width == null) return
    onApply(width)
    onClose()
  }

  return (
    <GridEventBoundary>
      <FormDialogShell
        open
        onOpenChange={(open) => !open && onClose()}
        title={ids.length > 1 ? `Szerokość ${ids.length} kolumn` : 'Szerokość kolumny'}
        description={`W pikselach, co najmniej ${RESIZE_MIN_PX}.`}
        confirmLabel="Zastosuj"
        onConfirm={apply}
        confirmDisabled={width == null}
      >
        <Input
          autoFocus
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="np. 120"
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply()
          }}
        />
      </FormDialogShell>
    </GridEventBoundary>
  )
}
