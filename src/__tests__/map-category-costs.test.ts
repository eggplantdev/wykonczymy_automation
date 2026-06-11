import { describe, it, expect } from 'vitest'
import { buildFinancialFields } from '@/lib/map-category-costs'
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

const base: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalCorrections: 0,
  totalIncome: 5000,
  totalLaborCosts: 1000,
  totalPayouts: 0,
  totalRabat: 0,
}

describe('buildFinancialFields — rabat row', () => {
  it('omits the Rabat field when totalRabat is 0', () => {
    const fields = buildFinancialFields(base, [])
    expect(fields.find((f) => f.label === 'Rabat')).toBeUndefined()
  })

  it('emits a positive Rabat field when there is a rabat', () => {
    const fields = buildFinancialFields({ ...base, totalRabat: 800 }, [])
    const rabat = fields.find((f) => f.label === 'Rabat')
    expect(rabat).toBeDefined()
    expect(rabat!.amount).toBe(800)
  })
})
