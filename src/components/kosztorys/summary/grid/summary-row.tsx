import { Fragment, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'
import { SummaryLabelCell, SummaryValueCell } from '@/components/ui/summary-grid'
import { ReconMismatchBadge } from '@/components/ui/recon-mismatch-badge'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { MoneyPairT, SummaryLineT } from '@/lib/kosztorys/summary-economics'
import { cn } from '@/lib/utils/cn'

export type SummaryRowOptsT = {
  emphasize?: boolean
  bold?: boolean
  discount?: boolean
  danger?: boolean
  // No-VAT figure: one amount, no netto/brutto axis. The sheet gives brutto its own row only for
  // prace + the R+M total; materiały/korekta/wpłaty have no brutto figure at all. The Brutto cell
  // repeats the netto amount rather than blanking, which also keeps the row readable in a
  // brutto-only widok, where blanking dropped its only value.
  noBrutto?: boolean
  // A custom formula/explanation tooltip on the label, independent of `noBrutto`. Used by the
  // materiały rows to state that VAT is subtracted (netto derived from brutto) — the inverse of the
  // prace direction, so the generic bez-VAT copy would be wrong here.
  hint?: string
  // When set, the figure screams via a red `!` icon (not a red value) whose tooltip is this string. Owner-only
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
 * `emphasize` keeps the summary rows bold now that the shared gridlines already draw every row
 * separator. A line's `share` is not rendered here — it feeds the charts.
 */
export function SummaryRow({ label, line, axis, ...opts }: SummaryRowPropsT) {
  const { net: showNet, gross: showGross } = axisShows(axis)
  const weight = cn(opts.emphasize && 'font-medium', opts.bold && 'font-bold')
  const accent = cn(opts.discount && 'text-chart-green', opts.danger && 'text-destructive')

  return (
    <Fragment>
      <SummaryLabelCell className={weight}>
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
          {opts.hint && (
            <HintTooltip content={opts.hint} className="text-muted-foreground">
              <Info className="size-3.5" aria-label="Informacja o pozycji" />
            </HintTooltip>
          )}
        </span>
      </SummaryLabelCell>
      {showNet && (
        <SummaryValueCell key="net" className={cn(weight, accent)}>
          {formatNet(line.net)}
        </SummaryValueCell>
      )}
      {/* A no-VAT row repeats its netto figure in the brutto cell rather than blanking: the amount
          IS the brutto (VAT doesn't apply), so restating it reads clearer than an absence. */}
      {showGross && (
        <SummaryValueCell key="gross" className={cn(weight, accent)}>
          {formatNet(opts.noBrutto ? line.net : line.gross)}
        </SummaryValueCell>
      )}
    </Fragment>
  )
}
