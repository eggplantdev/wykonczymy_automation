import type { DepositRowT } from '@/lib/kosztorys/deposit-planes'

/**
 * The three wpłata shapes the plane specs are written against — one gotówka (netto only), one
 * przelew (both kwoty off its faktura), one untagged legacy row.
 *
 * Shared rather than copied per spec: `deposit-planes` and `off-plane-deposits` assert the same
 * module family, so fixtures that could diverge would let the two suites disagree about what a
 * wpłata even is.
 */
export const cash = (amount: number): DepositRowT => ({ amount, netAmount: null, vatPlane: 'NET' })

export const untagged = (amount: number): DepositRowT => ({
  amount,
  netAmount: null,
  vatPlane: null,
})

export const transfer = (amount: number, netAmount: number): DepositRowT => ({
  amount,
  netAmount,
  vatPlane: 'GROSS',
})

/** A wpłata brutto with no netto. `getNetAmountError` has refused to save one since 2026-07-26 and
 *  prod has never held one, so this exists to pin what the sums do if raw SQL ever writes one. */
export const netlessTransfer = (amount: number): DepositRowT => ({
  amount,
  netAmount: null,
  vatPlane: 'GROSS',
})
