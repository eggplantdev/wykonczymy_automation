'use client'

import { toGross } from '@/lib/kosztorys/calc'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import {
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_MUTED,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryTable,
  type MutedAxisT,
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
  // Which money row (Netto or Brutto) is greyed while both show; undefined in Mieszane.
  mutedAxis?: MutedAxisT
}

// Suma transzy per etap + the „R netto / R brutto — suma prac wykonanych" readout (sheet r396/r397).
// Read-only: the executed value each etap delivered, at the active price view, netto and brutto.
export function KosztorysStageTotals({
  stages,
  stageTotals,
  wykonaneNet,
  vatRate,
  moneyAxis,
  mutedAxis,
}: PropsT) {
  if (stages.length === 0) return null
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  const money = (net: number, gross: boolean) => formatNet(gross ? toGross(net, vatRate) : net)

  // Same track system as the Podsumowanie block — a shared first (label) track, then equal-width
  // value tracks (one per etap plus the row total) — so both grids run on one 13rem + 7rem·n rhythm
  // and every column lines up down the panel.
  const valueTrackCount = stages.length + 1
  const gridTemplateColumns = `${SUMMARY_LABEL_COL} repeat(${valueTrackCount}, ${SUMMARY_VALUE_COL})`

  // Netto / Brutto share one shape — a label, a per-etap cell, and the bold row total. `muted`
  // greys the whole row when it's the inactive axis while both are on show.
  const row = (
    label: ReactNode,
    cell: (st: KosztorysStageT) => string,
    total: string,
    muted: boolean,
  ) => (
    <Fragment>
      <span className={cn(SUMMARY_LABEL_CELL, muted && SUMMARY_MUTED)}>{label}</span>
      {stages.map((st) => (
        <span key={st.id} className={cn(SUMMARY_VALUE_CELL, muted && SUMMARY_MUTED)}>
          {cell(st)}
        </span>
      ))}
      <span className={cn(SUMMARY_VALUE_CELL, 'font-bold', muted && SUMMARY_MUTED)}>{total}</span>
    </Fragment>
  )

  return (
    <div className="overflow-x-auto text-sm">
      <SummaryTable cols={gridTemplateColumns} className="w-max">
        <SummaryHeaderCell variant="label">Robocizna per etap</SummaryHeaderCell>
        {stages.map((st) => (
          <SummaryHeaderCell key={st.id}>{st.label ?? `Etap ${st.ordinal}`}</SummaryHeaderCell>
        ))}
        <SummaryHeaderCell>Razem</SummaryHeaderCell>
        {showNet &&
          row(
            'Netto',
            (st) => money(stageTotals.get(st.id) ?? 0, false),
            money(wykonaneNet, false),
            mutedAxis === 'net',
          )}
        {showGross &&
          row(
            'Brutto',
            (st) => money(stageTotals.get(st.id) ?? 0, true),
            money(wykonaneNet, true),
            mutedAxis === 'gross',
          )}
      </SummaryTable>
    </div>
  )
}
