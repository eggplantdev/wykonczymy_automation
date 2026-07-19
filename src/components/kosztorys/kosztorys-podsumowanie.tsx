'use client'

import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import {
  computeDoZaplatyRM,
  computePodsumowanie,
  moneyPair,
  summaryLine,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SUMMARY_LABEL_COL, SUMMARY_VALUE_COL } from '@/components/kosztorys/summary-grid'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import { cn } from '@/lib/utils/cn'

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
  hideShare?: boolean
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
  const hasDiscount = rabatAmount > 0
  const sumaPrac = summaryLine(sumaPracNet, lacznie.net, vatRate)
  const rabat = moneyPair(rabatAmount, vatRate)
  const wplaty = moneyPair(wplatyNet, vatRate)

  // First track shared with the etap-totals block so both grids' label columns align; the money
  // tracks appear only for the axis that's shown.
  const gridTemplateColumns = [
    SUMMARY_LABEL_COL,
    showNet && SUMMARY_VALUE_COL,
    showGross && SUMMARY_VALUE_COL,
    SUMMARY_VALUE_COL,
  ]
    .filter(Boolean)
    .join(' ')

  // All cells are direct children of ONE grid so `gap-px` over a `bg-border` container paints a
  // 1px separator between every column and row; each cell repaints `bg-background` on top.
  const labelCell = 'bg-background px-3 py-1'
  const valueCell = 'bg-background px-3 py-1 text-right tabular-nums'

  // A line with no `share` (the total rows) renders an empty udział cell. `emphasize` keeps the
  // summary rows bold now that the shared gridlines already draw every row separator.
  const row = (label: ReactNode, line: SummaryLineT | MoneyPairT, opts: RowOptsT = {}) => {
    const money = cn(
      valueCell,
      opts.emphasize && 'font-medium',
      opts.bold && 'font-bold',
      opts.discount && 'text-chart-green',
      opts.danger && 'text-destructive',
    )
    return (
      <Fragment>
        <span className={cn(labelCell, opts.emphasize && 'font-medium', opts.bold && 'font-bold')}>
          {label}
        </span>
        {showNet && <span className={money}>{formatNet(line.net)}</span>}
        {showGross && <span className={money}>{formatNet(line.gross)}</span>}
        <span className={cn(valueCell, 'text-muted-foreground', opts.emphasize && 'font-medium')}>
          {'share' in line && !opts.hideShare ? formatPercent(line.share) : ''}
        </span>
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
        {row('Suma prac wykonanych', sumaPrac)}
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
                summaryLine(item.net, lacznie.net, vatRate),
              )}
            </Fragment>
          ))}
        {row('Łącznie', lacznie, { emphasize: true, hideShare: true })}
      </div>
      <div style={{ gridTemplateColumns }} className="border-border bg-border grid gap-px border">
        {hasDiscount && row('Rabat', rabat, { discount: true })}
        {row(
          <Link
            href={`/inwestycje/${investmentId}?type=${DEPOSIT_TYPES.join(',')}`}
            className="hover:underline"
          >
            Wpłaty
          </Link>,
          wplaty,
          { discount: true },
        )}
        {row('Do zapłaty', doZaplaty, { bold: true, danger: doZaplaty.net > 0 })}
      </div>
    </div>
  )
}
