import { describe, expect, it } from 'vitest'
import { rowRemainingForView, stageValueForView } from '@/lib/kosztorys/calc'
import type { KosztorysItemT } from '@/types/kosztorys'

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
