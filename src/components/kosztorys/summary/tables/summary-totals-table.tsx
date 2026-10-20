'use client'

import { OptionalLink } from '@/components/ui/optional-link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

export type SettlementRowT = {
  label: string
  line: MoneyPairT
  hint?: string
  discount?: boolean
  bold?: boolean
  danger?: boolean | { net: boolean; gross: boolean }
  linkToDeposits?: boolean
}

export function SummaryTotalsTable({
  cols,
  caption,
  axis,
  rows,
  investmentId,
  preview,
}: {
  cols: string
  caption?: string
  axis: MoneyAxisT
  rows: SettlementRowT[]
  investmentId: number
  preview: boolean
}) {
  const { net, gross } = axisShows(axis)
  const bothPlanes = net && gross
  return (
    <SummaryTable cols={cols} className="w-fit">
      {(bothPlanes || caption !== undefined) && (
        <>
          <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
          {bothPlanes ? (
            <SummaryMoneyHeaders axis={axis} />
          ) : (
            <SummaryHeaderCell>Kwota</SummaryHeaderCell>
          )}
        </>
      )}
      {rows.map((row) => (
        <SummaryRow
          key={row.label}
          label={
            <OptionalLink
              href={
                row.linkToDeposits && !preview
                  ? investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES })
                  : null
              }
            >
              {row.label}
            </OptionalLink>
          }
          line={row.line}
          axis={axis}
          hint={row.hint}
          discount={row.discount}
          bold={row.bold}
          danger={row.danger}
        />
      ))}
    </SummaryTable>
  )
}
