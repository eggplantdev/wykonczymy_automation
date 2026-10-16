import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

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
        'grid-cell-text block w-full px-2 text-left break-words whitespace-pre-line',
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
