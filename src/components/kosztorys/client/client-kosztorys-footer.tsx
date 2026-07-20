'use client'

import { Fragment } from 'react'
import { toGross } from '@/lib/kosztorys/calc'
import { formatNet } from '@/lib/kosztorys/format'
import { SectionPie } from '@/components/kosztorys/client/section-pie'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
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
import {
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
  SummaryRow,
  summaryMoneyCols,
  type SummaryRowOptsT,
} from '@/components/kosztorys/summary-grid'
import { cn } from '@/lib/utils/cn'
import type { ClientKosztorysViewT } from '@/lib/kosztorys/types'

type PropsT = {
  view: ClientKosztorysViewT
  moneyAxis: MoneyAxisT
}

/**
 * A deliberate near-twin of `KosztorysPodsumowanie` rather than a reuse of it — that component takes
 * a live `reconciliation` prop and renders the EX-535 mismatch scream, an owner-internal check
 * against the transaction ledger. Its suppression gate is `priceView !== 'client'`, and this surface
 * IS the client view, so reusing it would leave the scream permanently on. The payload carries no
 * reconciliation at all; this component has nowhere to render one from.
 */
export function ClientKosztorysFooter({ view, moneyAxis }: PropsT) {
  const { totals, vatRate } = view
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  const { lacznie } = computePodsumowanie(totals.sumaPracNet, totals.materialsNet, vatRate)
  const amountDue = computeDoZaplatyRM(
    totals.robociznaNet,
    totals.depositsNet,
    totals.materialsNet,
    vatRate,
  )

  const moneyCols = summaryMoneyCols(moneyAxis)

  // Same row primitive the owner's Podsumowanie uses; `mismatch` is simply never passed, which is
  // what keeps the EX-535 reconciliation scream off a client-facing surface.
  const row = (label: string, line: SummaryLineT | MoneyPairT, opts: SummaryRowOptsT = {}) => (
    <SummaryRow label={label} line={line} axis={moneyAxis} {...opts} />
  )

  return (
    <div className="text-foreground flex w-fit flex-col gap-4 px-4 pt-2 pb-10 text-sm">
      <div
        style={{ gridTemplateColumns: `${moneyCols} ${SUMMARY_VALUE_COL}` }}
        className="border-border bg-border grid gap-px border"
      >
        <span className={cn(SUMMARY_LABEL_CELL, 'text-muted-foreground text-xs')}>
          Podsumowanie
        </span>
        {showNet && (
          <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}>Netto</span>
        )}
        {showGross && (
          <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}>Brutto</span>
        )}
        <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}>Udział</span>
        {row('Suma prac wykonanych', summaryLine(totals.sumaPracNet, lacznie.net, vatRate))}
        {totals.materialsBreakdown
          .filter((item) => item.net !== 0)
          .map((item) => (
            <Fragment key={item.id ?? 'correction'}>
              {row(item.label, summaryLineFace(item.net, lacznie.net), { noBrutto: true })}
            </Fragment>
          ))}
        {row('Łącznie', lacznie, { emphasize: true, hideShare: true })}
      </div>

      <div
        style={{ gridTemplateColumns: moneyCols }}
        className="border-border bg-border grid w-fit gap-px border"
      >
        {totals.discountNet > 0 &&
          row('Rabat', moneyPair(totals.discountNet, vatRate), {
            discount: true,
            noShareCell: true,
          })}
        {row('Wpłaty', faceValue(totals.depositsNet), {
          discount: true,
          noBrutto: true,
          noShareCell: true,
        })}
        {row('Do zapłaty', amountDue, { bold: true, noShareCell: true })}
      </div>

      {view.stages.length > 0 && (
        <div className="overflow-x-auto">
          <div
            style={{
              gridTemplateColumns: `${SUMMARY_LABEL_COL} repeat(${view.stages.length + 1}, ${SUMMARY_VALUE_COL})`,
            }}
            className="border-border bg-border grid w-max gap-px border"
          >
            <span className={cn(SUMMARY_LABEL_CELL, 'text-muted-foreground text-xs')}>
              Suma transzy
            </span>
            {view.stages.map((stage) => (
              <span
                key={stage.id}
                className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}
              >
                {stage.label ?? `Etap ${stage.ordinal}`}
              </span>
            ))}
            <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}>Razem</span>
            {showNet && (
              <Fragment>
                <span className={SUMMARY_LABEL_CELL}>Netto</span>
                {totals.stageTotals.map((stage) => (
                  <span key={stage.stageId} className={SUMMARY_VALUE_CELL}>
                    {formatNet(stage.net)}
                  </span>
                ))}
                <span className={cn(SUMMARY_VALUE_CELL, 'font-medium')}>
                  {formatNet(totals.robociznaNet)}
                </span>
              </Fragment>
            )}
            {showGross && (
              <Fragment>
                <span className={SUMMARY_LABEL_CELL}>Brutto</span>
                {totals.stageTotals.map((stage) => (
                  <span key={stage.stageId} className={SUMMARY_VALUE_CELL}>
                    {formatNet(toGross(stage.net, vatRate))}
                  </span>
                ))}
                <span className={cn(SUMMARY_VALUE_CELL, 'font-medium')}>
                  {formatNet(toGross(totals.robociznaNet, vatRate))}
                </span>
              </Fragment>
            )}
          </div>
        </div>
      )}

      {view.sections.length > 1 && <SectionPie sections={view.sections} />}
    </div>
  )
}
