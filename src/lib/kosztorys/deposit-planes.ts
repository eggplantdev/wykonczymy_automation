import type { VatPlaneT } from '@/lib/constants/transfers'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'

export type DepositRowT = {
  amount: number
  // Deliberately NOT derivable: it
  // differs from `amount ÷ (1+VAT)` by exactly the materiały share, which is the whole point.
  netAmount: number | null
  vatPlane: VatPlaneT | null
}

// `gross: null` means „nie dotyczy" — a wpłata netto has no brutto kwota.
export type DepositPairT = { net: number; gross: number | null }

export type DepositPlaneSumsT = {
  paidNet: number
  paidGrossNet: number
  // Complete only where a wpłata netto cannot occur —
  // i.e. tryb brutto, which is the only tryb that renders this column.
  paidGross: number
  paidNetCount: number
}

export const isGross = (row: { vatPlane: VatPlaneT | null }) => row.vatPlane === 'GROSS'

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

export function depositPairFromPlaneSums({
  paidNet,
  paidGrossNet,
  paidGross,
}: DepositPlaneSumsT): MoneyPairT {
  return { net: paidNet + paidGrossNet, gross: paidGross }
}

export function sumDeposits(rows: DepositRowT[]): MoneyPairT {
  return depositPairFromPlaneSums(bucketDepositsByPlane(rows))
}
