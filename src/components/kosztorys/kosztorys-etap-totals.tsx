'use client'

import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { toGross } from '@/lib/kosztorys/calc'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import {
  NOT_APPLICABLE,
  NOT_APPLICABLE_CELL,
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
} from '@/components/kosztorys/summary-grid'
import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type PropsT = {
  investmentId: number
  stages: KosztorysStageT[]
  // Per-etap „suma transzy" netto at the active view (stage id → net). Σ equals wykonaneNet.
  stageTotals: Map<number, number>
  // Per-etap zaliczki (tagged deposit cash), stage id → summed amount. A single cash figure —
  // not a netto/brutto pair — so it renders on one row regardless of the money axis.
  zaliczkiByStage: Record<number, number>
  // Wpłaty netto — every deposit on the investment (totalIncome). The remainder over the tagged
  // zaliczki is shown in a „Bez etapu" column so the row reconciles to the full Wpłaty — which is
  // why the row is labelled „Wpłaty", not „Zaliczki": its Razem is every deposit, tagged or not.
  wplatyNet: number
  // R netto — suma prac wykonanych: the executed total at the active view (Σ of the etap totals).
  wykonaneNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

// Suma transzy per etap + the „R netto / R brutto — suma prac wykonanych" readout (sheet r396/r397).
// Read-only: the executed value each etap delivered, at the active price view, netto and brutto.
export function KosztorysEtapTotals({
  investmentId,
  stages,
  stageTotals,
  zaliczkiByStage,
  wplatyNet,
  wykonaneNet,
  vatRate,
  moneyAxis,
}: PropsT) {
  if (stages.length === 0) return null
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  const money = (net: number, gross: boolean) => formatNet(gross ? toGross(net, vatRate) : net)

  const zaliczkiTotal = stages.reduce((sum, st) => sum + (zaliczkiByStage[st.id] ?? 0), 0)
  // Deposits not pinned to any etap — the gap between the tagged zaliczki and the full Wpłaty.
  const pozaEtapem = wplatyNet - zaliczkiTotal
  const showPoza = pozaEtapem > 0

  // Same track system as the Podsumowanie block — a shared first (label) track, then equal-width
  // value tracks (one per etap, an optional „Bez etapu" bucket, and the row total) — so both grids
  // run on one 13rem + 7rem·n rhythm and every column lines up down the panel.
  const valueTrackCount = stages.length + (showPoza ? 2 : 1)
  const gridTemplateColumns = `${SUMMARY_LABEL_COL} repeat(${valueTrackCount}, ${SUMMARY_VALUE_COL})`

  const labelCell = SUMMARY_LABEL_CELL
  const valueCell = SUMMARY_VALUE_CELL

  // Netto / Brutto / Wpłaty share one shape — a label, a per-etap cell, an optional „Bez etapu"
  // cell, and the bold row total.
  const row = (
    label: ReactNode,
    cell: (st: KosztorysStageT) => string,
    total: string,
    poza = '',
    valueClass = '',
  ) => (
    <Fragment>
      <span className={labelCell}>{label}</span>
      {stages.map((st) => (
        <span key={st.id} className={cn(valueCell, valueClass)}>
          {cell(st)}
        </span>
      ))}
      {/* Netto/Brutto pass no `poza` — those figures only exist per etap. Spelled out rather than
          left blank: an empty cell reads as „nie policzyliśmy", not „nie liczymy tego tutaj". */}
      {showPoza && (
        <span className={cn(valueCell, poza ? valueClass : NOT_APPLICABLE_CELL)}>
          {poza || NOT_APPLICABLE}
        </span>
      )}
      <span className={cn(valueCell, 'font-medium', valueClass)}>{total}</span>
    </Fragment>
  )

  return (
    <div className="border-border text-foreground shrink-0 border-t px-4 pt-4 pb-2 text-sm">
      <div className="overflow-x-auto">
        <div
          style={{ gridTemplateColumns }}
          className="border-border bg-border grid w-max gap-px border"
        >
          <span className={cn(labelCell, 'text-muted-foreground text-xs')}>Suma transzy</span>
          {stages.map((st) => (
            <span key={st.id} className={cn(valueCell, 'text-muted-foreground text-xs')}>
              {st.label ?? `Etap ${st.ordinal}`}
            </span>
          ))}
          {showPoza && (
            <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Bez etapu</span>
          )}
          <span className={cn(valueCell, 'text-muted-foreground text-xs')}>Razem</span>
          {showNet &&
            row(
              'Netto',
              (st) => money(stageTotals.get(st.id) ?? 0, false),
              money(wykonaneNet, false),
            )}
          {showGross &&
            row(
              'Brutto',
              (st) => money(stageTotals.get(st.id) ?? 0, true),
              money(wykonaneNet, true),
            )}
          {(zaliczkiTotal > 0 || showPoza) &&
            row(
              <Link
                href={`/inwestycje/${investmentId}?type=${DEPOSIT_TYPES.join(',')}`}
                className="hover:underline"
              >
                Wpłaty
              </Link>,
              (st) => formatNet(zaliczkiByStage[st.id] ?? 0),
              formatNet(zaliczkiTotal + pozaEtapem),
              formatNet(pozaEtapem),
              'text-chart-green',
            )}
        </div>
      </div>
    </div>
  )
}
