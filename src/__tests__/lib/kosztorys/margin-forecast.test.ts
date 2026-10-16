import { describe, expect, it } from 'vitest'
import { marginForecastByPlane } from '@/lib/kosztorys/margin-forecast'
import type { ViewPricingT } from '@/lib/kosztorys/types'

const item: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  descriptionTranslations: {},
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
  catalogueItemId: null,
  currentPlannedQty: null,
  aiPlannedQty: null,
  changeReason: null,
  reviewStatus: null,
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

  it('rabat nie rusza prognozy', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    expect(marginForecastByPlane([discounted]).w_tools).toEqual(
      marginForecastByPlane([item]).w_tools,
    )
  })

  it('Aktualizacja przedmiaru nie rusza prognozy', () => {
    expect(marginForecastByPlane([{ ...item, currentPlannedQty: 15 }])).toEqual(
      marginForecastByPlane([item]),
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

  it('pozycja bez przedmiaru nic nie wnosi', () => {
    const empty = { ...item, plannedQty: 0 }
    expect(marginForecastByPlane([empty]).w_tools).toEqual({
      clientNet: 0,
      subcontractorNet: 0,
      margin: 0,
    })
  })

  it('stawka podwykonawcy powyżej ceny inwestora daje ujemną prognozę', () => {
    const overpriced = { ...item, wToolsOverrideValue: 25 }
    expect(marginForecastByPlane([overpriced]).w_tools.margin).toBe(-50) // 200 − 250
  })
})
