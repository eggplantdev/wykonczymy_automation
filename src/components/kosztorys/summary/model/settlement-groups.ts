import { faceValue, type MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { SettlementRowT } from '@/components/kosztorys/summary/tables/summary-totals-table'

// The settlement steps as one table. `axis` is the panel's — the tryb decides which money columns
// exist, and these steps stand in the same ones as the breakdown above so the reader adds down a
// column.
export type SettlementGroupT = {
  caption?: string
  axis: MoneyAxisT
  rows: SettlementRowT[]
  footnote?: string
}

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
  // A nadpłata keeps the debt's label and its minus, explained by a footnote (owner, 2026-10-05):
  // „Nadpłata -24 407,39" read as a negative overpayment, i.e. a debt.
  const isNegative = showsNegative(amountDue, axis)
  rows.push({
    label: isNegative ? 'Pozostało do zapłaty*' : 'Pozostało do zapłaty',
    line: amountDue,
    bold: true,
    // Per cell: netto and brutto cross zero independently, so a slightly overpaid netto can sit
    // beside a real outstanding brutto. Rounded first — a bill settled to the grosz lands on 1e-13
    // rather than on 0 and would scream red beside „0,00".
    danger: { net: roundToCents(amountDue.net) > 0, gross: roundToCents(amountDue.gross) > 0 },
  })

  return [{ axis, rows, footnote: isNegative ? '*Minusowa kwota oznacza nadpłatę' : undefined }]
}

// ANY rendered plane — under axis 'both' a negative netto beside an outstanding brutto still prints a
// minus the reader needs explained.
function showsNegative(amountDue: MoneyPairT, axis: MoneyAxisT): boolean {
  const shows = axisShows(axis)
  return (
    (shows.net && roundToCents(amountDue.net) < 0) ||
    (shows.gross && roundToCents(amountDue.gross) < 0)
  )
}
