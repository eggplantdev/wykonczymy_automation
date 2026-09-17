import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Description } from '@/components/ui/description'
import { LabelHintIcon, type LabelHintT } from '@/components/ui/label-hint-icon'

// Shared column widths for the stacked summary grids. Both render as CSS grids and pin their first
// (label) column to the SAME width so the grids line up down the panel instead of each auto-sizing
// its own first column. A track is a `gridTemplateColumns` value, not an element, so these stay
// constants — everything else here is a component.
// `minmax`: a flat 16rem + 9rem overflows a phone, so this floors at `min(rem, vw)` — no media query
// reaches an inline `gridTemplateColumns` string — and caps at the existing desktop width.
export const SUMMARY_LABEL_COL = 'minmax(min(7rem, 24vw), 16rem)'
// Every trailing column (netto / brutto / udział) shares one width so they read as an even set.
export const SUMMARY_VALUE_COL = 'minmax(min(5.5rem, 22vw), 9rem)'

// Separators are real cell borders, not a `bg-border` container bleeding through `gap-px`: a gap is
// layout space, so backgrounds round over it at fractional row offsets and separators vanish.
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
      // max-w-full: without it, `w-fit`'s track-minimum sum grows past the parent instead of scrolling.
      // max-sm:text-xs: a phone has no room for a full label plus two or three money columns.
      className={cn(
        'border-border grid max-w-full overflow-x-auto border-t border-l max-sm:text-xs',
        className,
      )}
    >
      {children}
    </div>
  )
}

// The only three colours a summary cell may take — a bare grep for `text-chart-green` /
// `text-destructive` anywhere under summary/ means someone bypassed this and repaint drifts.
const CELL_TONE = {
  default: '',
  success: 'text-chart-green',
  error: 'text-destructive',
} as const

// The only two weights a summary cell may take, beyond the unstyled default.
const CELL_WEIGHT = {
  default: '',
  medium: 'font-medium',
  bold: 'font-bold',
} as const

export type SummaryCellToneT = keyof typeof CELL_TONE
export type SummaryCellWeightT = keyof typeof CELL_WEIGHT

// A one-line note tucked under a cell's value — an inline explanation (why it's negative, why it's
// unassigned) instead of a fourth unrelated row. Callers opt in with `note`; there is no second way
// to attach one, so every cell's note reads and lays out the same.
type SummaryCellNoteT = {
  text: string
  tone?: 'muted' | 'error'
}

type SummaryCellPropsT = {
  // Grey this cell (the inactive money column while both netto and brutto show). `opacity`, not a
  // muted text colour, so it also dims coloured amounts — success green, error red.
  muted?: boolean
  tone?: SummaryCellToneT
  weight?: SummaryCellWeightT
  className?: string
  children: ReactNode
  note?: SummaryCellNoteT | null
  // Hover-only explanation icons trailing the cell's content — the label-side counterpart to `note`.
  // Passed as variants rather than composed as children so every cell's hints render identically.
  hints?: LabelHintT[]
}

function CellNote({ note }: { note: SummaryCellNoteT }) {
  return (
    // No icon: a note here always sits directly under the figure it explains, so the leading glyph
    // carries nothing the position doesn't already say — and it steals width from a right-aligned
    // caption, pushing it onto a second line.
    <Description size="2xs" tone={note.tone ?? 'muted'} withIcon={false} className="font-normal">
      {note.text}
    </Description>
  )
}

// Keeps the hint icons on the content's own line (the note stacks below it), and stays out of the
// way entirely when a cell has no hints — most don't, and an extra wrapper would break `text-right`.
function CellContent({ children, hints }: { children: ReactNode; hints?: LabelHintT[] }) {
  if (!hints?.length) return children
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {hints.map((hint) => (
        <LabelHintIcon key={hint.variant} {...hint} />
      ))}
    </span>
  )
}

// `muted` dims here, not on the cell itself, so a 40%-opacity fill never lightens the cell's own
// border — the gridlines are the cell's borders now.
function CellBody({
  muted,
  note,
  align,
  hints,
  children,
}: {
  muted?: boolean
  note?: SummaryCellNoteT | null
  align: 'start' | 'end'
  hints?: LabelHintT[]
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        muted && 'opacity-40',
        note && (align === 'end' ? 'flex flex-col items-end' : 'flex flex-col items-start'),
      )}
    >
      <CellContent hints={hints}>{children}</CellContent>
      {note && <CellNote note={note} />}
    </span>
  )
}

// A label-track cell — one of the direct grid children the separators run between.
export function SummaryLabelCell({
  muted,
  tone,
  weight,
  className,
  children,
  note,
  hints,
}: SummaryCellPropsT) {
  return (
    <span
      className={cn(
        'border-border bg-background border-r border-b px-3 py-1 max-sm:px-2',
        CELL_TONE[tone ?? 'default'],
        CELL_WEIGHT[weight ?? 'default'],
        className,
      )}
    >
      <CellBody muted={muted} note={note} align="start" hints={hints}>
        {children}
      </CellBody>
    </span>
  )
}

// A value-track cell — right-aligned, tabular figures.
export function SummaryValueCell({
  muted,
  tone,
  weight,
  className,
  children,
  note,
  hints,
}: SummaryCellPropsT) {
  return (
    <span
      className={cn(
        'border-border bg-background border-r border-b px-3 py-1 text-right tabular-nums max-sm:px-2',
        CELL_TONE[tone ?? 'default'],
        CELL_WEIGHT[weight ?? 'default'],
        className,
      )}
    >
      <CellBody muted={muted} note={note} align="end" hints={hints}>
        {children}
      </CellBody>
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
