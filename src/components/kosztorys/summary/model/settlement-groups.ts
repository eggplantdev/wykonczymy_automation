import { faceValue, type MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { SettlementRowT } from '@/components/kosztorys/summary/tables/summary-totals-table'

export type SettlementGroupT = {
  caption?: string
  axis: MoneyAxisT
  rows: SettlementRowT[]
  footnote?: string
}

type ArgsT = {
  // The brutto sum is complete only in tryb brutto, the one tryb that renders that column.
  paid: MoneyPairT
  amountDue: MoneyPairT
  lossAmount: number
  axis: MoneyAxisT
}

export function buildSettlementGroups({
  paid,
  amountDue,
  lossAmount,
  axis,
}: ArgsT): SettlementGroupT[] {
  const rows: SettlementRowT[] = [
    {
      label: 'Wpłaty',
      line: { net: -paid.net, gross: -paid.gross },
      discount: true,
      linkToDeposits: true,
    },
  ]
  if (lossAmount !== 0) {
    rows.push({ label: 'Strata', line: faceValue(-lossAmount), discount: true })
  }
  const isNegative = showsNegative(amountDue, axis)
  rows.push({
    label: isNegative ? 'Pozostało do zapłaty*' : 'Pozostało do zapłaty',
    line: amountDue,
    bold: true,
    // Rounded first — a bill settled to the grosz lands on 1e-13 rather than on 0 and would scream
    // red beside „0,00".
    danger: { net: roundToCents(amountDue.net) > 0, gross: roundToCents(amountDue.gross) > 0 },
  })

  return [{ axis, rows, footnote: isNegative ? '*Minusowa kwota oznacza nadpłatę' : undefined }]
}

function showsNegative(amountDue: MoneyPairT, axis: MoneyAxisT): boolean {
  const shows = axisShows(axis)
  return (
    (shows.net && roundToCents(amountDue.net) < 0) ||
    (shows.gross && roundToCents(amountDue.gross) < 0)
  )
}
