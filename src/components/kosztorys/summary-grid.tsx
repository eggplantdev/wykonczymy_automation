import { Fragment, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'
import { ReconMismatchBadge } from '@/components/kosztorys/recon-mismatch-badge'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { MoneyPairT, SummaryLineT } from '@/lib/kosztorys/summary-economics'
import { cn } from '@/lib/utils/cn'

// Shared column widths for the two stacked summary blocks (etap totals + Podsumowanie). Both render
// as CSS grids and pin their first (label) column to the SAME width so the two grids line up down
// the panel instead of each auto-sizing its own first column. Values feed `gridTemplateColumns`.
export const SUMMARY_LABEL_COL = '13rem'
// Every trailing column (netto / brutto / udział) shares one width so they read as an even set.
export const SUMMARY_VALUE_COL = '7rem'

// Cell classes shared by both grids. All cells are direct children of ONE grid so `gap-px` over a
// `bg-border` container paints a 1px separator between every column and row; each cell repaints
// `bg-background` on top.
export const SUMMARY_LABEL_CELL = 'bg-background px-3 py-1'
export const SUMMARY_VALUE_CELL = 'bg-background px-3 py-1 text-right tabular-nums'

// For a cell whose figure doesn't exist on this row (a per-etap value has no „Bez etapu"). Muted so
// it stays out of the numbers. Only where another cell in the same row carries a real amount.
export const NOT_APPLICABLE = 'Nie dotyczy'
export const NOT_APPLICABLE_CELL = 'text-muted-foreground/60 text-xs font-normal'

// The money tracks appear only for the axis on show; the label track is fixed so this grid and the
// etap-totals grid above it keep their first columns aligned.
export function summaryMoneyCols(axis: MoneyAxisT) {
  const { net, gross } = axisShows(axis)
  return [SUMMARY_LABEL_COL, net && SUMMARY_VALUE_COL, gross && SUMMARY_VALUE_COL]
    .filter(Boolean)
    .join(' ')
}

export type SummaryRowOptsT = {
  emphasize?: boolean
  bold?: boolean
  discount?: boolean
  danger?: boolean
  // Drops the udział cell entirely. Only for the waterfall block, whose grid has no udział track —
  // every line there is off the Łącznie base.
  noShareCell?: boolean
  // Blanks the udział cell without dropping it. For Łącznie, which IS the udział base: a
  // self-referential 100% is meaningless, but the cell has to stay — remove it and the container's
  // bg-border shows through the uncovered track as a grey gap.
  hideShare?: boolean
  // No-VAT figure: one amount, no netto/brutto axis. The sheet gives brutto its own row only for
  // prace + the R+M total; materiały/korekta/wpłaty have no brutto figure at all. The Brutto cell
  // repeats the netto amount rather than blanking, which also keeps the row readable in a
  // brutto-only widok, where blanking dropped its only value.
  noBrutto?: boolean
  // When set, the figure screams: bold red value + a red `!` whose tooltip is this string. Owner-only
  // — the EX-535 reconciliation check against the transaction ledger. The client footer never passes
  // it, which is what lets both surfaces share this row instead of keeping two copies.
  mismatch?: string
}

type SummaryRowPropsT = SummaryRowOptsT & {
  label: ReactNode
  line: SummaryLineT | MoneyPairT
  axis: MoneyAxisT
}

/**
 * One row of a summary grid — emitted as a bare Fragment of cells, because every cell is a direct
 * child of ONE grid container (that is what makes `gap-px` paint the shared separators). Wrapping
 * the row in an element of its own would break the gridlines, so this cannot be a normal box.
 *
 * A line with no `share` (the total rows) renders an empty udział cell. `emphasize` keeps the
 * summary rows bold now that the shared gridlines already draw every row separator.
 */
export function SummaryRow({ label, line, axis, ...opts }: SummaryRowPropsT) {
  const { net: showNet, gross: showGross } = axisShows(axis)
  const hasShare = 'share' in line && !opts.hideShare
  const money = cn(
    SUMMARY_VALUE_CELL,
    opts.emphasize && 'font-medium',
    opts.bold && 'font-bold',
    opts.discount && 'text-chart-green',
    opts.danger && 'text-destructive',
    opts.mismatch && 'text-destructive font-bold',
  )

  return (
    <Fragment>
      <span
        className={cn(
          SUMMARY_LABEL_CELL,
          opts.emphasize && 'font-medium',
          opts.bold && 'font-bold',
        )}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {opts.mismatch && <ReconMismatchBadge content={opts.mismatch} />}
          {/* The row's brutto cell repeats its netto figure — flagged here so the repetition reads
              as „ta pozycja nie ma VAT-u", not as a rendering slip. */}
          {opts.noBrutto && showGross && (
            <HintTooltip
              content="Pozycja bez VAT — kwota brutto równa się netto"
              className="text-muted-foreground"
            >
              <Info className="size-3.5" aria-label="Pozycja bez VAT" />
            </HintTooltip>
          )}
        </span>
      </span>
      {showNet && <span className={money}>{formatNet(line.net)}</span>}
      {showGross && (
        // A no-VAT row repeats its netto figure here rather than blanking: the amount IS the
        // brutto (VAT doesn't apply), so restating it reads clearer than an absence.
        <span className={money}>{formatNet(opts.noBrutto ? line.net : line.gross)}</span>
      )}
      {!opts.noShareCell && (
        <span
          className={cn(
            SUMMARY_VALUE_CELL,
            'text-muted-foreground',
            opts.emphasize && 'font-medium',
          )}
        >
          {hasShare ? formatPercent(line.share) : ''}
        </span>
      )}
    </Fragment>
  )
}
