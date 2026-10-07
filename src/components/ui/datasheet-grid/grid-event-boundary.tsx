import type { ReactNode } from 'react'
import { swallowGridEvent } from '@/components/ui/datasheet-grid/swallow-grid-event'

// For a dialog opened from a grid cell: that cell stays the grid's active cell, so a key, paste or copy
// anywhere in the dialog would drive the grid underneath. A portal's events bubble through its React
// parents, so wrapping the dialog where the cell renders it covers every control inside.
export function GridEventBoundary({ children }: { children: ReactNode }) {
  return (
    <div
      className="contents"
      onKeyDown={swallowGridEvent}
      onPaste={swallowGridEvent}
      onCopy={swallowGridEvent}
      onCut={swallowGridEvent}
    >
      {children}
    </div>
  )
}
