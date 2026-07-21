'use client'

import { toGross } from '@/lib/kosztorys/calc'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import {
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
} from '@/components/kosztorys/summary-grid'
import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type PropsT = {
  stages: KosztorysStageT[]
  // Per-etap „suma transzy" netto at the active view (stage id → net). Σ equals wykonaneNet.
  stageTotals: Map<number, number>
  // R netto — suma prac wykonanych: the executed total at the active view (Σ of the etap totals).
  wykonaneNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

// Suma transzy per etap + the „R netto / R brutto — suma prac wykonanych" readout (sheet r396/r397).
// Read-only: the executed value each etap delivered, at the active price view, netto and brutto.
export function KosztorysEtapTotals({
  stages,
  stageTotals,
  wykonaneNet,
  vatRate,
  moneyAxis,
}: PropsT) {
  if (stages.length === 0) return null
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  const money = (net: number, gross: boolean) => formatNet(gross ? toGross(net, vatRate) : net)

  // Same track system as the Podsumowanie block — a shared first (label) track, then equal-width
  // value tracks (one per etap plus the row total) — so both grids run on one 13rem + 7rem·n rhythm
  // and every column lines up down the panel.
  const valueTrackCount = stages.length + 1
  const gridTemplateColumns = `${SUMMARY_LABEL_COL} repeat(${valueTrackCount}, ${SUMMARY_VALUE_COL})`

  const labelCell = SUMMARY_LABEL_CELL
  const valueCell = SUMMARY_VALUE_CELL

  // Netto / Brutto share one shape — a label, a per-etap cell, and the bold row total.
  const row = (label: ReactNode, cell: (st: KosztorysStageT) => string, total: string) => (
    <Fragment>
      <span className={labelCell}>{label}</span>
      {stages.map((st) => (
        <span key={st.id} className={valueCell}>
          {cell(st)}
        </span>
      ))}
      <span className={cn(valueCell, 'font-medium')}>{total}</span>
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
        </div>
      </div>
    </div>
  )
}
