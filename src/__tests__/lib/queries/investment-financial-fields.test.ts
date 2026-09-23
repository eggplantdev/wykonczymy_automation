import { describe, it, expect } from 'vitest'
import {
  buildFinancialFields,
  buildMaterialsBreakdown,
} from '@/lib/queries/investment-financial-fields'
import { DISCOUNT_LABEL } from '@/lib/constants/financial-field-labels'
import { calculateBalance } from '@/lib/db/calculate-balance'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

const base: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  materialsGrossBase: 0,
  materialsNetBilled: 0,
  totalIncome: 5000,
  totalLaborCosts: 1000,
  totalPayouts: 0,
  totalDiscount: 0,
  totalLoss: 0,
  totalSettled: 0,
  materialsNetDiscount: 0,
  settledCategoryCosts: [],
  netCategoryCosts: [],
}

describe('buildFinancialFields — rabat row', () => {
  it('omits the Rabat field when totalDiscount is 0', () => {
    const fields = buildFinancialFields(base, [])
    expect(fields.find((f) => f.label === DISCOUNT_LABEL)).toBeUndefined()
  })

  it('emits a positive Rabat field when there is a rabat', () => {
    const fields = buildFinancialFields({ ...base, totalDiscount: 800 }, [])
    const discount = fields.find((f) => f.label === DISCOUNT_LABEL)
    expect(discount).toBeDefined()
    expect(discount!.amount).toBe(800)
  })
})

describe('buildFinancialFields — corrections fold into their type (no separate line)', () => {
  it('a categorized correction is reflected once, inside its expense type', () => {
    // category 1 net = expense 1000 + correction -200 = 800 → amount -800
    const financials = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 800 }],
    }
    const fields = buildFinancialFields(financials, [{ id: 1, name: 'Materiały budowlane' }])
    const cat = fields.find((f) => f.label === 'Materiały budowlane')
    expect(cat!.amount).toBe(-800)
    expect(fields.find((f) => f.label === 'Korekty')).toBeUndefined()
  })
})

describe('buildMaterialsBreakdown', () => {
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
    const rows = buildMaterialsBreakdown(financials, cats)
    expect(rows.reduce((sum, r) => sum + r.net, 0)).toBe(950)
  })

  it('appends the signed „Korekta (bez kategorii)" remainder only when non-zero', () => {
    const balanced = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 500 }],
      totalMaterialCosts: 500,
    }
    expect(buildMaterialsBreakdown(balanced, cats).some((r) => r.id === null)).toBe(false)

    // A negative correction can drive the remainder below zero — kept signed, not clamped.
    const overCategorised = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 500 }],
      totalMaterialCosts: 400,
    }
    const remainder = buildMaterialsBreakdown(overCategorised, cats).find((r) => r.id === null)
    expect(remainder).toMatchObject({ id: null, net: -100 })
  })

  // Both figures are float sums of grosze, so a fully categorised investment leaves a ~1e-11 residue
  // that rendered a „Korekta (bez kategorii)" row at 0,00 zł and a −0,0% pie slice.
  it('ignores a sub-grosz float residue between the two sums', () => {
    const financials = {
      ...base,
      categoryCosts: [
        { categoryId: 1, total: 21_500.49 },
        { categoryId: 2, total: 43_363 },
      ],
      totalMaterialCosts: 21_500.49 + 43_363 + 1e-11,
    }
    expect(buildMaterialsBreakdown(financials, cats).some((r) => r.id === null)).toBe(false)
    expect(
      buildFinancialFields(financials, cats).some((f) => f.label === 'Korekta (bez kategorii)'),
    ).toBe(false)
  })

  // The „Materiały" tab gates on `rows.length`, so a placeholder per empty category made the count
  // lie and the tab rendered blank — empty-state message and all.
  it('drops categories with no spend instead of emitting a 0 zł placeholder', () => {
    const financials = {
      ...base,
      categoryCosts: [{ categoryId: 2, total: 300 }],
      totalMaterialCosts: 300,
    }

    expect(buildMaterialsBreakdown(financials, cats).map((r) => r.id)).toEqual([2])
    expect(buildMaterialsBreakdown({ ...base, totalMaterialCosts: 0 }, cats)).toEqual([])
  })

  it('drops a category billed wholly netto from the brutto plane, keeping its netto row', () => {
    const financials = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 1000 }],
      totalMaterialCosts: 1000,
    }

    expect(
      buildMaterialsBreakdown(
        financials,
        cats,
        [{ categoryId: 1, total: 1000 }],
        [{ categoryId: 1, total: 1080 }],
      ),
    ).toEqual([
      {
        id: 1,
        label: 'Materiały budowlane netto',
        net: 1000,
        origin: 'netBilled',
        recordedGross: 1080,
      },
    ])
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
    const rows = buildMaterialsBreakdown(financials, dupNames)
    const ids = rows.map((r) => r.id)
    expect(ids).toEqual([7, 9])
    expect(new Set(ids).size).toBe(ids.length)
  })

  // `netCategoryCosts` is a SUBSET of `categoryCosts`, so splitting it out must move value between
  // rows without changing the Σ — that is what keeps the podsumowanie reconciling with the page.
  describe('netto-billed rows', () => {
    const financials = {
      ...base,
      categoryCosts: [
        { categoryId: 1, total: 1500 },
        { categoryId: 2, total: 300 },
      ],
      totalMaterialCosts: 1800,
    }
    const netCategoryCosts = [{ categoryId: 1, total: 1000 }]
    // 8% apart, not 23%: the brutto must be the invoice's, not one the rate could reproduce.
    const netCategoryGrossCosts = [{ categoryId: 1, total: 1080 }]

    it('splits a mixed category into a brutto row and its own frozen „… netto" row', () => {
      const rows = buildMaterialsBreakdown(
        financials,
        cats,
        netCategoryCosts,
        netCategoryGrossCosts,
      )
      expect(rows.filter((r) => r.id === 1)).toEqual([
        { id: 1, label: 'Materiały budowlane', net: 500, origin: 'gross' },
        {
          id: 1,
          label: 'Materiały budowlane netto',
          net: 1000,
          origin: 'netBilled',
          recordedGross: 1080,
        },
      ])
    })

    it('leaves a category with nothing billed netto as a single brutto row', () => {
      const rows = buildMaterialsBreakdown(financials, cats, netCategoryCosts)
      expect(rows.filter((r) => r.id === 2)).toEqual([
        { id: 2, label: 'Materiały wykończeniowe', net: 300, origin: 'gross' },
      ])
    })

    it('Σ rows is unchanged by the split — value moves rows, it is never added', () => {
      const withSplit = buildMaterialsBreakdown(financials, cats, netCategoryCosts)
      const withoutSplit = buildMaterialsBreakdown(financials, cats)
      const sum = (rows: { net: number }[]) => rows.reduce((total, r) => total + r.net, 0)
      expect(sum(withSplit)).toBe(sum(withoutSplit))
      expect(sum(withSplit)).toBe(1800)
    })
  })
})

// The investment header renders „Bilans inwestora" as the SUM of these tiles while the listing calls
// calculateBalance, so a term with a place in the formula but no tile makes the two disagree.
describe('buildFinancialFields — Σ tiles reconciles with calculateBalance', () => {
  const cats = [
    { id: 1, name: 'Materiały budowlane' },
    { id: 2, name: 'Materiały wykończeniowe' },
  ]
  const sumTiles = (financials: InvestmentFinancialsT) =>
    buildFinancialFields(financials, cats).reduce((total, f) => total + f.amount, 0)

  const withMaterials: InvestmentFinancialsT = {
    ...base,
    categoryCosts: [
      { categoryId: 1, total: 1000 },
      { categoryId: 2, total: 200 },
    ],
    totalMaterialCosts: 1500,
    materialsGrossBase: 1500,
  }

  it('reconciles on an investment with rabat and a materiały concession', () => {
    const financials = { ...withMaterials, totalDiscount: 300, materialsNetDiscount: 280.49 }
    expect(sumTiles(financials)).toBeCloseTo(calculateBalance(financials), 2)
  })

  it('reconciles when neither concession is present', () => {
    expect(sumTiles(withMaterials)).toBeCloseTo(calculateBalance(withMaterials), 2)
  })

  it('reconciles with a loss on top of both concessions', () => {
    const financials = {
      ...withMaterials,
      totalDiscount: 300,
      materialsNetDiscount: 280.49,
      totalLoss: 362.84,
    }
    expect(sumTiles(financials)).toBeCloseTo(calculateBalance(financials), 2)
  })
})
