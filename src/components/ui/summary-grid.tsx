import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Description } from '@/components/ui/description'
import { LabelHintIcon, type LabelHintT } from '@/components/ui/label-hint-icon'

// `minmax`: a flat 16rem + 9rem overflows a phone, so this floors at `min(rem, vw)` — no media query
// reaches an inline `gridTemplateColumns` string.
export const SUMMARY_LABEL_COL = 'minmax(min(7rem, 24vw), 16rem)'
export const SUMMARY_VALUE_COL = 'minmax(min(5.5rem, 22vw), 9rem)'
export const SUMMARY_NAME_COL = 'minmax(min(9rem, 36vw), 20rem)'

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
      className={cn(
        'border-border grid max-w-full overflow-x-auto border-t border-l max-sm:text-xs',
        className,
      )}
    >
      {children}
    </div>
  )
}

const CELL_TONE = {
  default: '',
  success: 'text-chart-green',
  error: 'text-destructive',
} as const

const CELL_WEIGHT = {
  default: '',
  medium: 'font-medium',
  bold: 'font-bold',
} as const

export type SummaryCellToneT = keyof typeof CELL_TONE
export type SummaryCellWeightT = keyof typeof CELL_WEIGHT

type SummaryCellNoteT = {
  text: string
  tone?: 'muted' | 'error'
}

type SummaryCellPropsT = {
  // `opacity`, not a muted text colour, so it also dims coloured amounts — success green, error red.
  muted?: boolean
  tone?: SummaryCellToneT
  weight?: SummaryCellWeightT
  className?: string
  children: ReactNode
  note?: SummaryCellNoteT | null
  hints?: LabelHintT[]
}

function CellNote({ note }: { note: SummaryCellNoteT }) {
  return (
    <Description size="2xs" tone={note.tone ?? 'muted'} withIcon={false} className="font-normal">
      {note.text}
    </Description>
  )
}

// An extra wrapper would break `text-right`.
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
// border.
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

export function SummaryScrollRegion({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('min-h-0 w-full flex-1 overflow-y-auto', className)}>{children}</div>
}
