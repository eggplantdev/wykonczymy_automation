import { describe, expect, it } from 'vitest'
import { protocolSettlement } from '@/lib/kosztorys/acceptance-protocol/settlement'
import { sumDeposits } from '@/lib/kosztorys/deposit-planes'
import { computeAmountDue } from '@/lib/kosztorys/summary-economics'
import type { DepositTransactionRowT } from '@/types/transfers'

const deposit = (overrides: Partial<DepositTransactionRowT>): DepositTransactionRowT => ({
  id: 1,
  date: '2026-09-01',
  amount: 0,
  netAmount: null,
  vatPlane: 'NET',
  ...overrides,
})

const DEPOSITS = [
  deposit({ id: 1, amount: 5000, vatPlane: 'NET' }),
  deposit({ id: 2, amount: 2160, netAmount: 2000, vatPlane: 'GROSS' }),
]
const MATERIALS = { grossBase: 1230, netBilled: 300 }

describe('protocolSettlement', () => {
  it('lands on the summary’s own „Pozostało do zapłaty" netto for the same inputs', () => {
    const settlement = protocolSettlement({
      laborCostsNet: 12000,
      materials: MATERIALS,
      settlementMode: 'NET',
      materialsNetRate: 0.23,
      vatRate: 0.08,
      depositTransactions: DEPOSITS,
      lossAmount: 150,
    })

    const summary = computeAmountDue(12000, sumDeposits(DEPOSITS), MATERIALS, 0.08, 0.23, 150)
    expect(settlement.remainingNet).toBe(summary.net)
    expect(settlement).toMatchObject({
      laborCostsNet: 12000,
      materialsNet: 1300,
      totalNet: 13300,
      paidNet: 7000,
      lossNet: 150,
      isOverpaid: false,
    })
  })

  it('ignores the stored materiały rate in tryb brutto, as the summary does', () => {
    const settlement = protocolSettlement({
      laborCostsNet: 1000,
      materials: MATERIALS,
      settlementMode: 'GROSS',
      materialsNetRate: 0.23,
      vatRate: 0.08,
      depositTransactions: [],
      lossAmount: 0,
    })

    expect(settlement.materialsNet).toBe(1530)
  })

  it('flags an overpaid investment, but not one settled to the grosz', () => {
    const args = {
      materials: { grossBase: 0, netBilled: 0 },
      settlementMode: 'NET' as const,
      materialsNetRate: null,
      vatRate: 0.08,
      depositTransactions: [deposit({ amount: 1000.1 })],
      lossAmount: 0,
    }

    expect(protocolSettlement({ ...args, laborCostsNet: 1000 }).isOverpaid).toBe(true)
    expect(protocolSettlement({ ...args, laborCostsNet: 1000.1 }).isOverpaid).toBe(false)
  })
})
