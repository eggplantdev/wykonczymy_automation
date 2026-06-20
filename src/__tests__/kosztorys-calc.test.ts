import { describe, expect, it } from 'vitest'
import {
  rowRemainingForView,
  sectionSubtotalsForView,
  stageValueForView,
} from '@/lib/kosztorys/calc'
import type { KosztorysItemT, KosztorysV2RowT } from '@/types/kosztorys'

const item: KosztorysItemT = {
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
  subcontractorWToolsPrice: 12,
  subcontractorOwnToolsPrice: 10,
  costVariant: null,
  vatRate: null,
  hiddenInExport: false,
  note: null,
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
    // netto client = 10 × 20 = 200; wykonane = 60 → pozostało 140
    expect(rowRemainingForView(item, 60, 'client')).toBe(140)
    // netto w_tools = 10 × 12 = 120; wykonane = 36 → pozostało 84
    expect(rowRemainingForView(item, 36, 'w_tools')).toBe(84)
  })
})

// fixture: 2 sekcje, A (id 10) ma 2 pozycje, B (id 20) 1 pozycję
const v2Rows: KosztorysV2RowT[] = [
  {
    ...item,
    id: 1,
    sectionId: 10,
    sectionName: 'Sekcja A',
    sectionVatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
  },
  {
    ...item,
    id: 2,
    sectionId: 10,
    sectionName: 'Sekcja A',
    sectionVatRate: 0.08,
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
    sectionVatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
    clientPrice: 100, // 10×100 = 1000
  },
]

describe('sectionSubtotalsForView', () => {
  it('sumuje netto per sekcja, nie miesza sekcji', () => {
    const r = sectionSubtotalsForView(v2Rows, 'client')
    // Sekcja A: poz1 10×20=200 + poz2 40 = 240; Sekcja B: 1000
    expect(r.map((s) => [s.sectionId, s.net, s.itemCount])).toEqual([
      [10, 240, 2],
      [20, 1000, 1],
    ])
  })

  it('view-awareness: w_tools daje inne netto', () => {
    const r = sectionSubtotalsForView(v2Rows, 'w_tools')
    // poz1 10×12=120; poz2 5×12=60 −20% = 48 → A=168; B 10×12=120
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
