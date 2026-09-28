import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// `muted` covers the derived-value case: a subcontractor cell showing a value it isn't editable in
// this mode. `danger` flags a figure that's out of bounds (e.g. more executed than offered) — it
// overrides `muted` when both are set, since a cell is never muted AND alarming at once.
// The vertical box is globals.css's business: it stretches this span to the cell and pads it so the
// clip lands between lines rather than through one. Don't set a height here.
export function ReadOnlyCellText({
  children,
  muted,
  danger,
  emphasize,
  className,
}: {
  children: ReactNode
  muted?: boolean
  danger?: boolean
  emphasize?: boolean
  className?: string
}) {
  return (
    <span
      // A hook for a grid whose context voids the "derived, not editable" cue (globals.css).
      data-muted={muted && !danger ? '' : undefined}
      className={cn(
        // Wraps rather than truncating: a row taller than one line must fill that height with text,
        // and the row's own height is what limits how much shows. `break-words` keeps a single
        // unbroken word (a pasted URL, a long part number) inside the column instead of widening it.
        // `whitespace-pre-line` preserves the newlines the editing textarea lets people type.
        'block w-full px-2 text-left text-sm break-words whitespace-pre-line',
        muted && 'text-muted-foreground',
        danger && 'text-destructive',
        emphasize && 'font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}
