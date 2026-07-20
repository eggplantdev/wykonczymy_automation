import { describe, it, expect } from 'vitest'
import { buildFinancialFields, buildMaterialyBreakdown } from '@/lib/db/map-category-costs'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

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

describe('buildMaterialyBreakdown', () => {
  const cats = [
    { id: 1, name: 'Materiały budowlane' },
    { id: 2, name: 'Materiały wykończeniowe' },
    { id: 3, name: 'Pozostałe koszty' },
  ]

  it('Σ rows === totalMaterialCosts (reconciles with the investment page)', () => {
    const financials = {
      ...base,
      categoryCosts: [
        { categoryId: 1, total: 500 },
        { categoryId: 2, total: 300 },
      ],
      totalMaterialCosts: 950, // 200 not attributed to any category
    }
    const rows = buildMaterialyBreakdown(financials, cats)
    expect(rows.reduce((sum, r) => sum + r.net, 0)).toBe(950)
  })

  it('appends the signed „Korekta (bez kategorii)" remainder only when non-zero', () => {
    const balanced = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 500 }],
      totalMaterialCosts: 500,
    }
    expect(buildMaterialyBreakdown(balanced, cats).some((r) => r.id === null)).toBe(false)

    // A negative correction can drive the remainder below zero — kept signed, not clamped.
    const overCategorised = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 500 }],
      totalMaterialCosts: 400,
    }
    const remainder = buildMaterialyBreakdown(overCategorised, cats).find((r) => r.id === null)
    expect(remainder).toMatchObject({ id: null, net: -100 })
  })

  it('every category row carries a stable, distinct id even when names collide', () => {
    // Two categories share a display name — the row id must stay unique so React keys never clash.
    const dupNames = [
      { id: 7, name: 'Inne' },
      { id: 9, name: 'Inne' },
    ]
    const financials = {
      ...base,
      categoryCosts: [
        { categoryId: 7, total: 100 },
        { categoryId: 9, total: 200 },
      ],
      totalMaterialCosts: 300,
    }
    const rows = buildMaterialyBreakdown(financials, dupNames)
    const ids = rows.map((r) => r.id)
    expect(ids).toEqual([7, 9])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
