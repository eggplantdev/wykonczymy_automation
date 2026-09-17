import type { VatPlaneT } from '@/lib/constants/transfers'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'

// SPIKE (2026-08-23) — nothing crosses VAT any more. A wpłata carries the figures it actually had:
// gotówka is one netto kwota and has no brutto at all, a przelew is booked with BOTH kwoty off the
// faktura (`amount` brutto, `netAmount` its netto). The old model derived the missing side at flat
// VAT, which cannot be right on a bill built from two rates — materiały enter tryb brutto at the
// shop's 23% while robocizna grosses at the faktura's, so grossing a wpłata by the faktura rate
// credited the client money he never paid (owner, 2026-08-23).
export type DepositRowT = {
  amount: number
  // The netto off the faktura, stored only on a wpłata brutto. Deliberately NOT derivable: it
  // differs from `amount ÷ (1+VAT)` by exactly the materiały share, which is the whole point.
  netAmount: number | null
  vatPlane: VatPlaneT | null
}

// A wpłata on both planes, where `gross: null` means „nie dotyczy" — a wpłata netto has no brutto
// kwota, and inventing one is what this spike removes.
export type DepositPairT = { net: number; gross: number | null }

/** The sums a set of wpłaty reduces to. Kept as raw sums rather than a pair because the listing
 *  folds them in SQL, where no row is in reach — so both sides hand the same shape to
 *  `depositPairFromPlaneSums` and neither gets to invent its own arithmetic. */
export type DepositPlaneSumsT = {
  // Σ of the wpłaty netto — they ARE the netto plane, in full.
  paidNet: number
  // Σ of the netto kwoty of wpłaty brutto, where the faktura named one.
  paidGrossNet: number
  // Σ on the brutto plane: wpłaty brutto ONLY. Complete only where a wpłata netto cannot occur —
  // i.e. tryb brutto, which is the only tryb that renders this column.
  paidGross: number
  // How MANY wpłaty make up `paidNet`. A sum cannot say „ile" and the warning has to (EX-724): the
  // listing folds its wpłaty in SQL and never sees a row, so the count travels with the money.
  paidNetCount: number
}

export const isGross = (row: { vatPlane: VatPlaneT | null }) => row.vatPlane === 'GROSS'

// A wpłata brutto with no netto counts as 0 zł netto, deliberately: `getNetAmountError` has made
// that row unsaveable since 2026-07-26, and no such row has ever existed in prod. Deriving one at
// VAT — the bridge that used to live here — is the derivation this whole model rejects, so a row
// that could only arrive by raw SQL does not get a guessed netto to make it look plausible.
export function depositRowPair(row: DepositRowT): DepositPairT {
  if (!isGross(row)) return { net: row.amount, gross: null }
  return { net: row.netAmount ?? 0, gross: row.amount }
}

export const NO_DEPOSIT_SUMS: DepositPlaneSumsT = {
  paidNet: 0,
  paidGrossNet: 0,
  paidGross: 0,
  paidNetCount: 0,
}

export function bucketDepositsByPlane(rows: DepositRowT[]): DepositPlaneSumsT {
  return rows.reduce<DepositPlaneSumsT>((acc, row) => {
    if (!isGross(row)) {
      return { ...acc, paidNet: acc.paidNet + row.amount, paidNetCount: acc.paidNetCount + 1 }
    }
    return {
      ...acc,
      paidGross: acc.paidGross + row.amount,
      paidGrossNet: acc.paidGrossNet + (row.netAmount ?? 0),
    }
  }, NO_DEPOSIT_SUMS)
}

// The one place the sums become the pair the settlement subtracts — so the panel (which reduces
// rows) and the listing (which reduces in SQL) can never fold the two planes by two rules.
export function depositPairFromPlaneSums({
  paidNet,
  paidGrossNet,
  paidGross,
}: DepositPlaneSumsT): MoneyPairT {
  return { net: paidNet + paidGrossNet, gross: paidGross }
}

// Σ of a set of wpłaty on each plane — the deduction step every tryb subtracts from „Łącznie".
export function sumDeposits(rows: DepositRowT[]): MoneyPairT {
  return depositPairFromPlaneSums(bucketDepositsByPlane(rows))
}
