import type { DepositRowT } from '@/lib/kosztorys/deposit-planes'

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

export const netlessTransfer = (amount: number): DepositRowT => ({
  amount,
  netAmount: null,
  vatPlane: 'GROSS',
})
