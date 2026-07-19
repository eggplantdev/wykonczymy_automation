'use client'

import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { Info, TriangleAlert } from 'lucide-react'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { HintTooltip } from '@/components/ui/tooltip'
import {
  computeDoZaplatyRM,
  computePodsumowanie,
  faceValue,
  moneyPair,
  summaryLine,
  summaryLineFace,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SUMMARY_LABEL_COL, SUMMARY_VALUE_COL } from '@/components/kosztorys/summary-grid'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import {
  reconciliationTooltip,
  type KosztorysReconciliationT,
  type ReconT,
} from '@/lib/kosztorys/reconciliation'
import { cn } from '@/lib/utils/cn'

// The scream's tooltip names both compared figures + the różnica; formatNet because this surface shows
// kosztorys nets. Shared copy with the investment page (reconciliationTooltip).
const mismatchTooltip = (recon: ReconT, subject: string) =>
  reconciliationTooltip(recon, subject, formatNet)

type PropsT = {
  investmentId: number
  // Robocizna wartość netto (do zapłaty, po rabacie) — client-side, reacts to unsaved edits.
  robociznaNet: number
  // Materiały netto — live server sum of the investment's unsettled transactions.
  materialyNet: number
  // Per-expense-category split of materialyNet (v1 parity); Σ === materialyNet.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Wpłaty netto — the investor's deposits on this investment (totalIncome); subtracted from
  // Łącznie to reach „Do zapłaty". Matches the investment page's „Wpłaty" by construction.
  wplatyNet: number
  // The rabat actually taken off the executed robocizna (net zł): the global discount when active,
  // else Σ per-item rabat. Unified upstream so this table shows one explicit „Rabat" line. 0 = none.
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — the mismatch scream renders off this (Phase 2).
  reconciliation: KosztorysReconciliationT
  vatRate: number
  moneyAxis: MoneyAxisT
}

type RowOptsT = {
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
  // When set, the figure screams: bold red value + a red `!` whose tooltip is this string.
  mismatch?: string
}

// The single bottom summary block: the robocizna waterfall (Suma prac wykonanych → Rabat →
// Robocizna) merged with the sheet Podsumowanie split (Robocizna / Materiały / Łącznie, udział %
// of Łącznie), then Wpłaty subtracted to reach „Do zapłaty" — one grid, no separate totals bar.
export function KosztorysPodsumowanie({
  investmentId,
  robociznaNet,
  materialyNet,
  materialyBreakdown,
  wplatyNet,
  rabatAmount,
  reconciliation,
  vatRate,
  moneyAxis,
}: PropsT) {
  // Łącznie is the pre-rabat total (Suma prac + Materiały), so the rows above it reconcile to it;
  // Rabat then deducts from Łącznie down to „Do zapłaty" as its own waterfall line below. robociznaNet
  // arrives already net of rabat, so add it back for the Łącznie/udział base.
  const sumaPracNet = robociznaNet + rabatAmount
  const { lacznie } = computePodsumowanie(sumaPracNet, materialyNet, vatRate)
  const doZaplaty = computeDoZaplatyRM(robociznaNet, wplatyNet, materialyNet, vatRate)
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch — otherwise the one gap population most needs to catch stays invisible.
  const showRabat =
    rabatAmount > 0 || reconciliation.rabat.actual > 0 || reconciliation.rabat.mismatch
  const sumaPrac = summaryLine(sumaPracNet, lacznie.net, vatRate)
  // Rabat is an obniżka of prace, so it lives on the prace plane and grosses — brutto = rabat×(1+VAT).
  // Grossing it keeps the brutto waterfall exact: Łącznie − rabat − wpłaty = Do zapłaty on both axes
  // (toGross is linear). Wpłaty stays face value — it's a cash deposit, not prace.
  const rabat = moneyPair(rabatAmount, vatRate)
  const wplaty = faceValue(wplatyNet)

  // First track shared with the etap-totals block so both grids' label columns align; the money
  // tracks appear only for the axis that's shown.
  const moneyCols = [
    SUMMARY_LABEL_COL,
    showNet && SUMMARY_VALUE_COL,
    showGross && SUMMARY_VALUE_COL,
  ]
    .filter(Boolean)
    .join(' ')
  const gridTemplateColumns = `${moneyCols} ${SUMMARY_VALUE_COL}`

  // All cells are direct children of ONE grid so `gap-px` over a `bg-border` container paints a
  // 1px separator between every column and row; each cell repaints `bg-background` on top.
  const labelCell = 'bg-background px-3 py-1'
  const valueCell = 'bg-background px-3 py-1 text-right tabular-nums'

  // A line with no `share` (the total rows) renders an empty udział cell. `emphasize` keeps the
  // summary rows bold now that the shared gridlines already draw every row separator.
  const row = (label: ReactNode, line: SummaryLineT | MoneyPairT, opts: RowOptsT = {}) => {
    const hasShare = 'share' in line && !opts.hideShare
    const money = cn(
      valueCell,
      opts.emphasize && 'font-medium',
      opts.bold && 'font-bold',
      opts.discount && 'text-chart-green',
      opts.danger && 'text-destructive',
      opts.mismatch && 'text-destructive font-bold',
    )
    return (
      <Fragment>
        <span className={cn(labelCell, opts.emphasize && 'font-medium', opts.bold && 'font-bold')}>
          <span className="inline-flex items-center gap-1">
            {label}
            {opts.mismatch && (
              <HintTooltip content={opts.mismatch} className="text-destructive">
                <TriangleAlert className="size-3.5" aria-label="Niezgodność z transakcjami" />
              </HintTooltip>
            )}
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
          <span className={cn(valueCell, 'text-muted-foreground', opts.emphasize && 'font-medium')}>
            {hasShare ? formatPercent(line.share) : ''}
          </span>
        )}
      </Fragment>
    )
  }

  return (
    <div className="text-foreground flex w-fit flex-col gap-4 px-4 pt-2 pb-10 text-sm">
      <div style={{ gridTemplateColumns }} className="border-border bg-border grid gap-px border">
        <span className={cn(labelCell, 'text-muted-foreground text-xs')}>Podsumowanie</span>
        {showNet && <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Netto</span>}
        {showGross && (
          <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Brutto</span>
        )}
        <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Udział</span>
        {row('Suma prac wykonanych', sumaPrac, {
          mismatch: reconciliation.robocizna.mismatch
            ? mismatchTooltip(reconciliation.robocizna, 'Transakcje robocizny')
            : undefined,
        })}
        {materialyBreakdown
          .filter((item) => item.net !== 0)
          .map((item) => (
            <Fragment key={item.id ?? 'korekta'}>
              {row(
                item.id !== null ? (
                  <Link
                    href={`/inwestycje/${investmentId}?expenseCategory=${item.id}`}
                    className="hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  item.label
                ),
                summaryLineFace(item.net, lacznie.net),
                { noBrutto: true },
              )}
            </Fragment>
          ))}
        {row('Łącznie', lacznie, { emphasize: true, hideShare: true })}
      </div>
      <div
        style={{ gridTemplateColumns: moneyCols }}
        className="border-border bg-border grid w-fit gap-px border"
      >
        {showRabat &&
          row('Rabat', rabat, {
            discount: true,
            noShareCell: true,
            mismatch: reconciliation.rabat.mismatch
              ? mismatchTooltip(reconciliation.rabat, 'Transakcje rabatu')
              : undefined,
          })}
        {row(
          <Link
            href={`/inwestycje/${investmentId}?type=${DEPOSIT_TYPES.join(',')}`}
            className="hover:underline"
          >
            Wpłaty
          </Link>,
          wplaty,
          { discount: true, noBrutto: true, noShareCell: true },
        )}
        {row('Do zapłaty', doZaplaty, { bold: true, danger: doZaplaty.net > 0, noShareCell: true })}
      </div>
    </div>
  )
}
