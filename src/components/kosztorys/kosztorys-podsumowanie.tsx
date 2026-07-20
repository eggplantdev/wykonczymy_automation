'use client'

import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
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
import type { PriceViewT } from '@/lib/kosztorys/calc'
import {
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
  SummaryRow,
  summaryMoneyCols,
  type SummaryRowOptsT,
} from '@/components/kosztorys/summary-grid'
import { ReconMismatchBadge } from '@/components/kosztorys/recon-mismatch-badge'
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
  // Robocizna/rabat reconciliation verdict — the mismatch scream renders off this.
  reconciliation: KosztorysReconciliationT
  // Active price view. The verdict compares client-view nets, so the scream only reads correctly in
  // 'client'; a subcontractor view reprices the displayed figure, so the scream is suppressed there.
  priceView: PriceViewT
  vatRate: number
  moneyAxis: MoneyAxisT
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
  priceView,
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
  // The scream compares client-view nets; a subcontractor view reprices the displayed figure, so the
  // scream would sit next to a number it isn't comparing. Show it only in the client view.
  const reconVisible = priceView === 'client'
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch — otherwise the one gap population most needs to catch stays invisible.
  // Only while the scream is visible; otherwise the row follows the normal „rabat > 0" rule.
  const showRabat =
    rabatAmount > 0 ||
    (reconVisible && (reconciliation.rabat.actual > 0 || reconciliation.rabat.mismatch))
  const sumaPrac = summaryLine(sumaPracNet, lacznie.net, vatRate)
  // Rabat is an obniżka of prace, so it lives on the prace plane and grosses — brutto = rabat×(1+VAT).
  // Grossing it keeps the brutto waterfall exact: Łącznie − rabat − wpłaty = Do zapłaty on both axes
  // (toGross is linear). Wpłaty stays face value — it's a cash deposit, not prace.
  const rabat = moneyPair(rabatAmount, vatRate)
  const wplaty = faceValue(wplatyNet)

  const moneyCols = summaryMoneyCols(moneyAxis)
  const gridTemplateColumns = `${moneyCols} ${SUMMARY_VALUE_COL}`

  const labelCell = SUMMARY_LABEL_CELL
  const valueCell = SUMMARY_VALUE_CELL

  const row = (label: ReactNode, line: SummaryLineT | MoneyPairT, opts: SummaryRowOptsT = {}) => (
    <SummaryRow label={label} line={line} axis={moneyAxis} {...opts} />
  )

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
          mismatch:
            reconVisible && reconciliation.robocizna.mismatch
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
            mismatch:
              reconVisible && reconciliation.rabat.mismatch
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
