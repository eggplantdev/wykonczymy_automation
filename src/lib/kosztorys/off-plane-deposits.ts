import type { VatPlaneT } from '@/lib/constants/transfers'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { DepositPlaneSumsT } from '@/lib/kosztorys/deposit-planes'

export function isOffPlaneDeposit(
  row: { vatPlane: VatPlaneT | null },
  mode: SettlementModeT,
): boolean {
  if (mode === 'MIXED') return false
  return mode === 'NET' ? row.vatPlane === 'GROSS' : row.vatPlane !== 'GROSS'
}

export function offPlaneDeposits<RowT extends { vatPlane: VatPlaneT | null }>(
  rows: RowT[],
  mode: SettlementModeT,
): RowT[] {
  return rows.filter((row) => isOffPlaneDeposit(row, mode))
}

// A gotówka on an investment settled brutto has no brutto kwota at all —
// since nothing is derived at VAT, the settlement counts it as zero and the client reads as not
// having paid.
export function strandsDeposit(
  plane: VatPlaneT | null | undefined,
  mode: SettlementModeT,
): boolean {
  return mode === 'GROSS' && plane !== 'GROSS'
}

export type StrandedDepositsT = { count: number; amount: number }

// The netto bucket IS the stranded set: it is filtered by
// „plane is not GROSS", which is exactly what `strandsDeposit` asks.
export function strandedFromPlaneSums(
  { paidNet, paidNetCount }: DepositPlaneSumsT,
  mode: SettlementModeT,
): StrandedDepositsT | undefined {
  if (!strandsDeposit(null, mode) || paidNetCount === 0) return undefined
  return { count: paidNetCount, amount: paidNet }
}

export function depositsStrandedBy<RowT extends { vatPlane: VatPlaneT | null; amount: number }>(
  rows: RowT[],
  nextMode: SettlementModeT,
): StrandedDepositsT {
  const stranded = rows.filter((row) => strandsDeposit(row.vatPlane, nextMode))
  return {
    count: stranded.length,
    amount: stranded.reduce((sum, row) => sum + row.amount, 0),
  }
}
