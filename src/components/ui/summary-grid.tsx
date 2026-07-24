import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// Shared column widths for the stacked summary grids. Both render as CSS grids and pin their first
// (label) column to the SAME width so the grids line up down the panel instead of each auto-sizing
// its own first column. A track is a `gridTemplateColumns` value, not an element, so these stay
// constants — everything else here is a component.
export const SUMMARY_LABEL_COL = '16rem'
// Every trailing column (netto / brutto / udział) shares one width so they read as an even set.
export const SUMMARY_VALUE_COL = '7rem'

// The shared table shell every summary grid repeats: a `bg-border` container whose `gap-px` paints
// 1px separators between the (direct-child) cells its rows lay down; each cell repaints `bg-background`
// on top. `cols` is the `gridTemplateColumns` track list. Callers pass width helpers (`w-fit`) via
// `className`.
export function SummaryTable({
  cols,
  className,
  children,
}: {
  cols: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      style={{ gridTemplateColumns: cols }}
      className={cn('border-border bg-border grid gap-px border', className)}
    >
      {children}
    </div>
  )
}

type SummaryCellPropsT = {
  // Grey this cell (the inactive money column while both netto and brutto show). `opacity`, not a
  // muted text colour, so it also dims coloured amounts — discount green, danger red.
  muted?: boolean
  className?: string
  children: ReactNode
}

// A label-track cell — one of the direct grid children the separators run between.
export function SummaryLabelCell({ muted, className, children }: SummaryCellPropsT) {
  return (
    <span className={cn('bg-background px-3 py-1', muted && 'opacity-40', className)}>
      {children}
    </span>
  )
}

// A value-track cell — right-aligned, tabular figures.
export function SummaryValueCell({ muted, className, children }: SummaryCellPropsT) {
  return (
    <span
      className={cn(
        'bg-background px-3 py-1 text-right tabular-nums',
        muted && 'opacity-40',
        className,
      )}
    >
      {children}
    </span>
  )
}

// A column header cell over the label track (`variant="label"`) or a value track (default).
export function SummaryHeaderCell({
  variant = 'value',
  muted,
  className,
  children,
}: {
  variant?: 'label' | 'value'
  muted?: boolean
  className?: string
  children: ReactNode
}) {
  const Cell = variant === 'label' ? SummaryLabelCell : SummaryValueCell
  return (
    <Cell muted={muted} className={cn('text-muted-foreground text-xs', className)}>
      {children}
    </Cell>
  )
}

// The single scroll region shared by both totals-panel planes: it grows to fill the collapsible's
// bounded body and scrolls internally, so the content clears the toolbar instead of hiding under it
// while the trigger bar stays pinned above. Flex-bounded (not a viewport max-height) so it tracks the
// actual panel height in one place.
export function SummaryScrollRegion({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('min-h-0 w-full flex-1 overflow-y-auto', className)}>{children}</div>
}
