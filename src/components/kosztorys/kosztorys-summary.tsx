'use client'

import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Info } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'
import {
  computeSummarySplit,
  moneyPair,
  summaryLine,
  summaryLineFace,
  type DepositBucketsT,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'
import { KosztorysDoZaplatyBlock } from '@/components/kosztorys/kosztorys-do-zaplaty-block'
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
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import { cn } from '@/lib/utils/cn'

// recharts is heavy and client-only — load both pies lazily so the library never enters the editor's
// main chunk; it arrives in its own async chunk only when this footer panel renders.
const SectionSharePie = dynamic(
  () => import('@/components/kosztorys/section-share-pie').then((m) => m.SectionSharePie),
  { ssr: false },
)
const CostStructurePie = dynamic(
  () => import('@/components/kosztorys/cost-structure-pie').then((m) => m.CostStructurePie),
  { ssr: false },
)

// The scream's tooltip names both compared figures + the różnica; formatNet because this surface shows
// kosztorys nets. Shared copy with the investment page (reconciliationTooltip).
const mismatchTooltip = (recon: ReconT, subject: string) =>
  reconciliationTooltip(recon, subject, formatNet)

type PropsT = {
  investmentId: number
  // Robocizna wartość netto (po rabacie) — client-side, reacts to unsaved edits.
  laborCostsNetFromKosztorys: number
  // The „Do zapłaty" pair (robocizna + materiały − wpłaty), computed by the panel so its collapsed
  // headline and this table's bottom row can't drift apart.
  doZaplaty: MoneyPairT
  // Materiały netto — live server sum of the investment's unsettled transactions.
  materialyNet: number
  // Per-expense-category split of materialyNet (v1 parity); Σ === materialyNet.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Client-priced, view-invariant per-section subtotals — the section pie's structure source.
  sectionSubtotals: SectionSliceInputT[]
  // The investor's deposits split by plane — feeds the hide-exempt Wpłaty / Do zapłaty block.
  deposits: DepositBucketsT
  // The rabat actually taken off the executed robocizna (net zł): the global discount when active,
  // else Σ per-item rabat. Unified upstream so this table shows one explicit „Rabat" line. 0 = none.
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — the mismatch scream renders off this. Always supplied
  // (the body computes it unconditionally); clientView suppresses the scream via reconVisible, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  // Active price view. The verdict compares client-view nets, so the scream only reads correctly in
  // 'client'; a subcontractor view reprices the displayed figure, so the scream is suppressed there.
  priceView: PriceViewT
  vatRate: number
  moneyAxis: MoneyAxisT
  // Read-only client render: the mismatch scream is an owner-internal signal (a client's view is
  // always 'client', which is exactly when the scream would fire), and the internal drill-down links
  // point at owner-only pages — so gate the scream off and render those labels as plain text.
  clientView?: boolean
}

// The single bottom summary block: the robocizna waterfall (Suma prac wykonanych → Rabat →
// Robocizna) merged with the sheet Podsumowanie split (Robocizna / Materiały / Łącznie, udział %
// of Łącznie), then the hide-exempt Wpłaty / Do zapłaty block below the waterfall grid.
export function KosztorysSummary({
  investmentId,
  laborCostsNetFromKosztorys,
  doZaplaty,
  materialyNet,
  materialyBreakdown,
  sectionSubtotals,
  deposits,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  moneyAxis,
  clientView = false,
}: PropsT) {
  // Łącznie is the pre-rabat total (Suma prac + Materiały), so the rows above it reconcile to it;
  // Rabat then deducts from Łącznie down to „Do zapłaty" as its own waterfall line below.
  // laborCostsNetFromKosztorys arrives already net of rabat, so add it back for the Łącznie/udział base.
  const sumaPracNet = laborCostsNetFromKosztorys + rabatAmount
  const { combined } = computeSummarySplit(sumaPracNet, materialyNet, vatRate)
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  // The scream compares client-view nets; a subcontractor view reprices the displayed figure, so the
  // scream would sit next to a number it isn't comparing. Show it only in the client view.
  const reconVisible = clientView ? false : priceView === 'client'
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch — otherwise the one gap population most needs to catch stays invisible.
  // Only while the scream is visible; otherwise the row follows the normal „rabat > 0" rule.
  const showRabat =
    rabatAmount > 0 ||
    (reconVisible && (reconciliation.rabat.actual > 0 || reconciliation.rabat.mismatch))
  const sumaPrac = summaryLine(sumaPracNet, combined.net, vatRate)
  // Rabat is an obniżka of prace, so it lives on the prace plane and grosses — brutto = rabat×(1+VAT).
  // NOTE: the visible waterfall no longer „foots" to Do zapłaty on the brutto axis — under the
  // sequential deposit model (computeDoZaplatyRM) a netto-flagged wpłata reduces the base pre-VAT, so
  // the gross Do zapłaty is short of `Łącznie − rabat − wpłaty` by `sumNet×VAT` by design. The four
  // Wpłaty / Do zapłaty figures come from that model, in the block below — not from column subtraction.
  const rabat = moneyPair(rabatAmount, vatRate)

  const moneyCols = summaryMoneyCols(moneyAxis)
  const gridTemplateColumns = `${moneyCols} ${SUMMARY_VALUE_COL}`

  const labelCell = SUMMARY_LABEL_CELL
  const valueCell = SUMMARY_VALUE_CELL

  const row = (label: ReactNode, line: SummaryLineT | MoneyPairT, opts: SummaryRowOptsT = {}) => (
    <SummaryRow label={label} line={line} axis={moneyAxis} {...opts} />
  )

  return (
    <div className="text-foreground flex flex-wrap items-start gap-x-12 gap-y-8 px-4 pt-2 pb-10 text-sm">
      <div className="flex w-fit flex-col gap-4">
        <div style={{ gridTemplateColumns }} className="border-border bg-border grid gap-px border">
          <span className={cn(labelCell, 'text-muted-foreground text-xs')}>Podsumowanie</span>
          {showNet && <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Netto</span>}
          {showGross && (
            <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Brutto</span>
          )}
          <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Udział</span>
          {row('Suma prac wykonanych', sumaPrac, {
            mismatch:
              reconVisible && reconciliation.laborCosts.mismatch
                ? mismatchTooltip(reconciliation.laborCosts, 'Transakcje robocizny')
                : undefined,
          })}
          {materialyBreakdown
            .filter((item) => item.net !== 0)
            .map((item) => (
              <Fragment key={item.id ?? 'korekta'}>
                {row(
                  item.id !== null && !clientView ? (
                    <Link
                      href={`/inwestycje/${investmentId}?expenseCategory=${item.id}`}
                      className="hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  ),
                  summaryLineFace(item.net, combined.net),
                  { noBrutto: true },
                )}
              </Fragment>
            ))}
          {row('Łącznie', combined, { emphasize: true, hideShare: true })}
        </div>
        {showRabat && (
          <div
            style={{ gridTemplateColumns: moneyCols }}
            className="border-border bg-border grid w-fit gap-px border"
          >
            {row('Rabat', rabat, {
              discount: true,
              noShareCell: true,
              mismatch:
                reconVisible && reconciliation.rabat.mismatch
                  ? mismatchTooltip(reconciliation.rabat, 'Transakcje rabatu')
                  : undefined,
            })}
          </div>
        )}
        {/* The four Wpłaty / Do zapłaty figures — one locked, hide-exempt block (same source as the
            collapsed headline), lifted out of the axis-gated waterfall so the MoneyAxisToggle can't
            hide any of them. */}
        <KosztorysDoZaplatyBlock deposits={deposits} doZaplaty={doZaplaty} />
      </div>

      {/* disabled temporarily do not remove */}
      {/* <div className="flex flex-wrap items-start gap-x-12 gap-y-8"> */}
      {/* <SectionSharePie subtotals={sectionSubtotals} /> */}
      {/* <CostStructurePie sumaPracNet={sumaPracNet} materialyBreakdown={materialyBreakdown} /> */}
      {/* </div> */}
    </div>
  )
}
