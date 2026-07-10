import { describe, expect, it } from 'vitest'
import {
  rowNetForView,
  rowRemainingForView,
  sectionSubtotalsForView,
  stageValueForView,
} from '@/lib/kosztorys/calc'
import type { KosztorysV2RowT, ViewPricingT } from '@/types/kosztorys'

// Subcontractor prices as an 'amount' override (flat 12/10) — preserves the values from before
// the migration to the coefficient model (the tests validate the amount path, not the derivation).
const item: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 10,
  measuredQty: 10,
  discountType: null,
  discountValue: 0,
  clientPrice: 20,
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: 12,
  ownToolsOverrideType: 'amount',
  ownToolsOverrideValue: 10,
  costVariant: null,
  hiddenInExport: false,
  note: null,
  sectionWToolsCoeff: null,
  sectionOwnToolsCoeff: null,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

describe('stageValueForView', () => {
  it('liczy wartość etapu wg ceny widoku', () => {
    expect(stageValueForView(item, 3, 'client')).toBe(60) // 3 × 20
    expect(stageValueForView(item, 3, 'w_tools')).toBe(36) // 3 × 12
    expect(stageValueForView(item, 3, 'own_tools')).toBe(30) // 3 × 10
  })

  it('uwzględnia rabat procentowy', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    expect(stageValueForView(discounted, 3, 'client')).toBe(54) // 60 − 10%
  })
})

describe('rowRemainingForView', () => {
  it('pozostało = netto widoku − wykonane', () => {
    // client net = 10 × 20 = 200; done = 60 → remaining 140
    expect(rowRemainingForView(item, 60, 'client')).toBe(140)
    // w_tools net = 10 × 12 = 120; done = 36 → remaining 84
    expect(rowRemainingForView(item, 36, 'w_tools')).toBe(84)
  })
})

// fixture: 2 sections, A (id 10) has 2 items, B (id 20) has 1 item
const v2Rows: KosztorysV2RowT[] = [
  {
    ...item,
    id: 1,
    sectionId: 10,
    sectionName: 'Sekcja A',
    vatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
  },
  {
    ...item,
    id: 2,
    sectionId: 10,
    sectionName: 'Sekcja A',
    vatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
    measuredQty: 5,
    clientPrice: 10,
    discountType: 'percent',
    discountValue: 20, // 5×10 = 50 − 20% = 40
  },
  {
    ...item,
    id: 3,
    sectionId: 20,
    sectionName: 'Sekcja B',
    vatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
    clientPrice: 100, // 10×100 = 1000
  },
]

// Brutto is the grid's read-only Brutto column + Suma brutto: gross = net × (1 + vatRate), on the
// post-discount net (rowNetForView already subtracts the discount). One rate per investment.
const gross = (row: ViewPricingT, view: Parameters<typeof rowNetForView>[1], vatRate: number) =>
  rowNetForView(row, view) * (1 + vatRate)

describe('brutto = netto × (1 + vatRate)', () => {
  it('plain row, 8%', () => {
    // client net = 10 × 20 = 200 → brutto 216
    expect(gross(item, 'client', 0.08)).toBeCloseTo(216, 10)
  })

  it('post-discount net (VAT on the discounted amount)', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    // net = 200 − 10% = 180 → brutto 180 × 1.08 = 194.4
    expect(gross(discounted, 'client', 0.08)).toBeCloseTo(194.4, 10)
  })

  it('consistent across price views (VAT on the active net)', () => {
    // w_tools net = 10 × 12 = 120 → 129.6; own_tools net = 10 × 10 = 100 → 108
    expect(gross(item, 'w_tools', 0.08)).toBeCloseTo(129.6, 10)
    expect(gross(item, 'own_tools', 0.08)).toBeCloseTo(108, 10)
  })

  it('23% rate', () => {
    expect(gross(item, 'client', 0.23)).toBeCloseTo(246, 10)
  })
})

describe('sectionSubtotalsForView', () => {
  it('sumuje netto per sekcja, nie miesza sekcji', () => {
    const r = sectionSubtotalsForView(v2Rows, 'client')
    // Section A: item1 10×20=200 + item2 40 = 240; Section B: 1000
    expect(r.map((s) => [s.sectionId, s.net, s.itemCount])).toEqual([
      [10, 240, 2],
      [20, 1000, 1],
    ])
  })

  it('view-awareness: w_tools daje inne netto', () => {
    const r = sectionSubtotalsForView(v2Rows, 'w_tools')
    // item1 10×12=120; item2 5×12=60 −20% = 48 → A=168; B 10×12=120
    expect(r[0].net).toBe(168)
    expect(r[1].net).toBe(120)
  })

  it('share sumuje do ~1 gdy grandNet > 0', () => {
    const r = sectionSubtotalsForView(v2Rows, 'client')
    expect(r.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10)
    expect(r[1].share).toBeCloseTo(1000 / 1240, 10)
  })

  it('guard: grandNet = 0 → share 0, bez NaN', () => {
    const zero = v2Rows.map((row) => ({ ...row, clientPrice: 0 }))
    const r = sectionSubtotalsForView(zero, 'client')
    expect(r.every((s) => s.share === 0)).toBe(true)
  })
})
