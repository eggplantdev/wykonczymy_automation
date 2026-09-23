import { describe, expect, it } from 'vitest'
import { marginForecastByPlane } from '@/lib/kosztorys/margin-forecast'
import type { ViewPricingT } from '@/lib/kosztorys/types'

// Przedmiar 10 × 20 zl = 200 zl on the client side. The crew carries two hard-coded amounts — 12
// with tools, 10 without — because the scenario is what has to tell them apart.
const item: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 10,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 20,
  wToolsOverrideValue: 12,
  ownToolsOverrideValue: 10,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

describe('marginForecastByPlane', () => {
  it('wycenia przedmiar po obu stronach i zwraca różnicę', () => {
    expect(marginForecastByPlane([item]).w_tools).toEqual({
      clientNet: 200,
      subcontractorNet: 120,
      margin: 80,
    })
  })

  it('scenariusz zmienia wyłącznie stronę podwykonawcy', () => {
    const own = marginForecastByPlane([item]).own_tools
    expect(own.clientNet).toBe(200)
    expect(own.subcontractorNet).toBe(100)
    expect(own.margin).toBe(100)
  })

  it('stawka ze współczynnika idzie za scenariuszem tak samo jak wpisana ręcznie', () => {
    const derived: ViewPricingT = {
      ...item,
      wToolsOverrideValue: null,
      ownToolsOverrideValue: null,
    }
    expect(marginForecastByPlane([derived]).w_tools.subcontractorNet).toBe(130) // 10 × 20 × 0.65
    expect(marginForecastByPlane([derived]).own_tools.subcontractorNet).toBe(110) // 10 × 20 × 0.55
  })

  // Owner's call (2026-08-18): a rabat is not granted up front, so the forecast prices the
  // przedmiar at the full rate. Routed through rowPlannedNetForView the rabat would trim the client
  // side alone, and the forecast would grow by exactly the rabat. One case here as the integration
  // smoke — all three rabat kinds are pinned at the source in `kosztorys-calc.test.ts`.
  it('rabat nie rusza prognozy', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    expect(marginForecastByPlane([discounted]).w_tools).toEqual(
      marginForecastByPlane([item]).w_tools,
    )
  })

  it('sumuje pozycje', () => {
    const second = { ...item, id: 2, plannedQty: 5, clientPrice: 40 }
    const both = marginForecastByPlane([item, second]).w_tools
    expect(both.clientNet).toBe(400) // 200 + 5 × 40
    expect(both.subcontractorNet).toBe(180) // 120 + 5 × 12
    expect(both.margin).toBe(220)
  })

  it('pusty kosztorys to zera, nie NaN', () => {
    expect(marginForecastByPlane([]).w_tools).toEqual({
      clientNet: 0,
      subcontractorNet: 0,
      margin: 0,
    })
  })

  // Quantities are never negative — an item with no przedmiar cannot contribute a negative amount.
  it('pozycja bez przedmiaru nic nie wnosi', () => {
    const empty = { ...item, plannedQty: 0 }
    expect(marginForecastByPlane([empty]).w_tools).toEqual({
      clientNet: 0,
      subcontractorNet: 0,
      margin: 0,
    })
  })

  // A steep rabat eats the margin at the full price — but that is the actual margin, not the
  // forecast. This pins that the forecast can only go negative through the crew's rate itself.
  it('stawka podwykonawcy powyżej ceny inwestora daje ujemną prognozę', () => {
    const overpriced = { ...item, wToolsOverrideValue: 25 }
    expect(marginForecastByPlane([overpriced]).w_tools.margin).toBe(-50) // 200 − 250
  })
})
