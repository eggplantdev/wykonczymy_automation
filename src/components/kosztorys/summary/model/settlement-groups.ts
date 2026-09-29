import { faceValue, type MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { SettlementRowT } from '@/components/kosztorys/summary/tables/summary-totals-table'

// The settlement steps as one table. `axis` is the panel's — the tryb decides which money columns
// exist, and these steps stand in the same ones as the breakdown above so the reader adds down a
// column.
export type SettlementGroupT = { caption?: string; axis: MoneyAxisT; rows: SettlementRowT[] }

type ArgsT = {
  // The wpłaty summed on each plane from the kwoty they carry (`sumDeposits`) — a wpłata brutto
  // holds its own netto off the faktura, a wpłata netto has no brutto at all. The brutto sum is
  // therefore complete only in tryb brutto, the one tryb that renders that column.
  paid: MoneyPairT
  amountDue: MoneyPairT
  lossAmount: number
  axis: MoneyAxisT
}

// One pool of wpłaty, one debt — one table, read top-down in every tryb: „Łącznie" less the wpłaty
// (and the strata) resolves to „Pozostało do zapłaty" on each plane the tryb shows.
//
// Wpłaty render negative — they are the deduction steps down to „Pozostało do zapłaty", and a
// positive figure in a subtracted row reads as if it were being added.
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
  // „Strata" — a cost the company swallowed, so the client stops owing it. A deduction step like
  // „Wpłaty", but at face value on both planes: unlike a wpłata it never crossed a VAT bridge, and
  // unlike a rabat it is not a concession on the price. Rendered only when there is one; an
  // investment with no strata says nothing rather than printing a 0 zł step.
  if (lossAmount !== 0) {
    rows.push({ label: 'Strata', line: faceValue(-lossAmount), discount: true })
  }
  rows.push({
    label: isOverpaid(amountDue, axis) ? 'Nadpłata' : 'Pozostało do zapłaty',
    line: amountDue,
    bold: true,
    // Per cell: netto and brutto cross zero independently, so a slightly overpaid netto can sit
    // beside a real outstanding brutto. Rounded first — a bill settled to the grosz lands on 1e-13
    // rather than on 0 and would scream red beside „0,00".
    danger: { net: roundToCents(amountDue.net) > 0, gross: roundToCents(amountDue.gross) > 0 },
  })

  return [{ axis, rows }]
}

// The debt has flipped: every plane the tryb renders is settled and then some, so the row names what
// the figure actually is. Requires ALL shown planes — under axis 'both' a negative netto can sit
// beside a real outstanding brutto, and that is still a debt.
function isOverpaid(amountDue: MoneyPairT, axis: MoneyAxisT): boolean {
  const shows = axisShows(axis)
  const planes: number[] = []
  if (shows.net) planes.push(amountDue.net)
  if (shows.gross) planes.push(amountDue.gross)
  return planes.length > 0 && planes.every((value) => roundToCents(value) < 0)
}
