import { describe, it, expect } from 'vitest'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'

const adminCtx = { id: 1 } as const

describe('transactions report — filter combinations', () => {
  it('all filters combined produce correct Where', () => {
    const where = buildTransferFilters(
      {
        type: 'INVESTMENT_EXPENSE',
        sourceRegister: '1',
        investment: '5',
        createdBy: '3',
        paymentMethod: 'CASH',
        otherCategory: '2',
        from: '2024-01-01',
        to: '2024-12-31',
      },
      adminCtx,
    )
    expect(where.type).toEqual({ in: ['INVESTMENT_EXPENSE'] })
    expect(where.or).toEqual([{ sourceRegister: { in: [1] } }, { targetRegister: { in: [1] } }])
    expect(where.investment).toEqual({ in: [5] })
    expect(where.createdBy).toEqual({ in: [3] })
    expect(where.paymentMethod).toEqual({ in: ['CASH'] })
    expect(where.otherCategory).toEqual({ in: [2] })
    expect(where.date).toEqual({
      greater_than_equal: '2024-01-01',
      less_than_equal: '2024-12-31',
    })
  })
})
