'use client'

import { Fragment } from 'react'
import { toGross } from '@/lib/kosztorys/calc'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
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
} from '@/components/kosztorys/summary-grid'
import { cn } from '@/lib/utils/cn'
import type { ClientKosztorysViewT } from '@/lib/kosztorys/types'

type PropsT = {
  view: ClientKosztorysViewT
  moneyAxis: MoneyAxisT
}

/**
 * The client's footer: the Podsumowanie waterfall, the per-etap suma transzy, and the section split.
 *
 * A deliberate near-twin of `KosztorysPodsumowanie` rather than a reuse of it — that component takes
 * a live `reconciliation` prop and renders the EX-535 mismatch scream, an owner-internal check
 * against the transaction ledger. Its suppression gate is `priceView !== 'client'`, and this surface
 * IS the client view, so reusing it would leave the scream permanently on. The payload carries no
 * reconciliation at all; this component has nowhere to render one from.
 */
export function ClientKosztorysFooter({ view, moneyAxis }: PropsT) {
  const { totals, vatRate } = view
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  const { lacznie } = computePodsumowanie(totals.sumaPracNet, totals.materialyNet, vatRate)
  const doZaplaty = computeDoZaplatyRM(
    totals.robociznaNet,
    totals.wplatyNet,
    totals.materialyNet,
    vatRate,
  )

  const moneyCols = [
    SUMMARY_LABEL_COL,
    showNet && SUMMARY_VALUE_COL,
    showGross && SUMMARY_VALUE_COL,
  ]
    .filter(Boolean)
    .join(' ')

  const row = (
    label: string,
    line: SummaryLineT | MoneyPairT,
    opts: {
      emphasize?: boolean
      bold?: boolean
      discount?: boolean
      noShareCell?: boolean
      hideShare?: boolean
      // No-VAT figure (materiały, wpłaty): brutto repeats netto rather than blanking, so the cell
      // still reads as an amount in a brutto-only widok.
      noBrutto?: boolean
    } = {},
  ) => {
    const hasShare = 'share' in line && !opts.hideShare
    const money = cn(
      SUMMARY_VALUE_CELL,
      opts.emphasize && 'font-medium',
      opts.bold && 'font-bold',
      opts.discount && 'text-chart-green',
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
          {label}
        </span>
        {showNet && <span className={money}>{formatNet(line.net)}</span>}
        {showGross && (
          <span className={money}>{formatNet(opts.noBrutto ? line.net : line.gross)}</span>
        )}
        {!opts.noShareCell && (
          <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground')}>
            {hasShare ? formatPercent(line.share) : ''}
          </span>
        )}
      </Fragment>
    )
  }

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
        {totals.materialyBreakdown
          .filter((item) => item.net !== 0)
          .map((item) => (
            <Fragment key={item.id ?? 'korekta'}>
              {row(item.label, summaryLineFace(item.net, lacznie.net), { noBrutto: true })}
            </Fragment>
          ))}
        {row('Łącznie', lacznie, { emphasize: true, hideShare: true })}
      </div>

      <div
        style={{ gridTemplateColumns: moneyCols }}
        className="border-border bg-border grid w-fit gap-px border"
      >
        {totals.rabatNet > 0 &&
          row('Rabat', moneyPair(totals.rabatNet, vatRate), {
            discount: true,
            noShareCell: true,
          })}
        {row('Wpłaty', faceValue(totals.wplatyNet), {
          discount: true,
          noBrutto: true,
          noShareCell: true,
        })}
        {row('Do zapłaty', doZaplaty, { bold: true, noShareCell: true })}
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

      {view.sections.length > 1 && (
        <div
          style={{
            gridTemplateColumns: `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`,
          }}
          className="border-border bg-border grid w-fit gap-px border"
        >
          <span className={cn(SUMMARY_LABEL_CELL, 'text-muted-foreground text-xs')}>Sekcje</span>
          <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}>Netto</span>
          <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}>Udział</span>
          {view.sections.map((section) => (
            <Fragment key={section.sectionId}>
              <span className={SUMMARY_LABEL_CELL}>{section.sectionName}</span>
              <span className={SUMMARY_VALUE_CELL}>{formatNet(section.net)}</span>
              <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground')}>
                {formatPercent(section.share)}
              </span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
