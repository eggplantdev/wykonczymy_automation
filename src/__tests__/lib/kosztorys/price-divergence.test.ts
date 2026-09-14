import { describe, expect, it } from 'vitest'
import { divergentPriceRowIds } from '@/lib/kosztorys/price-divergence'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(overrides: Partial<KosztorysV2RowT> = {}): KosztorysV2RowT {
  return {
    id: 1,
    sectionId: 10,
    displayOrder: 0,
    description: 'Dwukrotne gruntowanie ścian, sufitów i podłóg',
    unit: 'm2',
    plannedQty: 95,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 10,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
    note: null,
    sectionName: 'Łazienka 1',
    sectionColor: null,
    vatRate: 0.08,
    globalDiscountActive: false,
    globalWToolsCoeff: 0.65,
    globalOwnToolsCoeff: 0.5,
    ...overrides,
  } as KosztorysV2RowT
}

describe('divergentPriceRowIds', () => {
  it('returns EVERY pozycja of a diverging group, not only the odd one out', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Łazienka 1', clientPrice: 10 }),
      row({ id: 2, sectionId: 11, sectionName: 'Łazienka 2', clientPrice: 7 }),
      row({ id: 3, sectionId: 12, sectionName: 'Łazienka 3', clientPrice: 7 }),
    ]
    expect(divergentPriceRowIds(rows)).toEqual(new Set([1, 2, 3]))
  })

  it('returns nothing when the same praca carries one price everywhere', () => {
    const rows = [
      row({ id: 1, sectionId: 10, clientPrice: 10 }),
      row({ id: 2, sectionId: 11, clientPrice: 10 }),
    ]
    expect(divergentPriceRowIds(rows)).toEqual(new Set())
  })

  it('folds j.m. variants into one group (m2 = m²)', () => {
    const rows = [
      row({ id: 1, unit: 'm2', clientPrice: 10 }),
      row({ id: 2, unit: 'm²', sectionId: 11, sectionName: 'Kuchnia', clientPrice: 7 }),
    ]
    expect(divergentPriceRowIds(rows)).toEqual(new Set([1, 2]))
  })

  it('keeps the same opis at different j.m. apart — two prices, two groups, no divergence', () => {
    const rows = [
      row({ id: 1, unit: 'm2', clientPrice: 10 }),
      row({ id: 2, unit: 'szt', clientPrice: 7 }),
    ]
    expect(divergentPriceRowIds(rows)).toEqual(new Set())
  })

  it('leaves a pozycja without a price out of the comparison', () => {
    const rows = [row({ id: 1, clientPrice: 0 }), row({ id: 2, sectionId: 11, clientPrice: 10 })]
    expect(divergentPriceRowIds(rows)).toEqual(new Set())
  })

  it('never groups pozycje with an empty opis', () => {
    const rows = [
      row({ id: 1, description: '', clientPrice: 10 }),
      row({ id: 2, description: null, sectionId: 11, clientPrice: 7 }),
    ]
    expect(divergentPriceRowIds(rows)).toEqual(new Set())
  })

  it('never reports a lone pozycja', () => {
    expect(divergentPriceRowIds([row({ id: 1 })])).toEqual(new Set())
  })
})
