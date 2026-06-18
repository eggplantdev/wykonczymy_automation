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
  totalLoss: 0,
  totalSettled: 0,
  settledCategoryCosts: [],
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

describe('buildFinancialFields — corrections fold into their type (no separate line)', () => {
  it('never emits a "Korekty" field, even when totalCorrections != 0', () => {
    const fields = buildFinancialFields({ ...base, totalCorrections: -2000 }, [])
    expect(fields.find((f) => f.label === 'Korekty')).toBeUndefined()
  })

  it('a categorized correction is reflected once, inside its expense type', () => {
    // category 1 net = expense 1000 + correction -200 = 800 → amount -800
    const financials = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 800 }],
      totalCorrections: -200,
    }
    const fields = buildFinancialFields(financials, [{ id: 1, name: 'Materiały budowlane' }])
    const cat = fields.find((f) => f.label === 'Materiały budowlane')
    expect(cat!.amount).toBe(-800)
    expect(fields.find((f) => f.label === 'Korekty')).toBeUndefined()
  })
})
