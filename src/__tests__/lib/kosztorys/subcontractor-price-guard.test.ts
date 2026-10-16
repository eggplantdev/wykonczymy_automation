import { describe, expect, it } from 'vitest'
import {
  MAX_CLIENT_SHARE,
  clientShareCeilingLabel,
  checkSubcontractorPrice,
  coeffWarning,
  isCoeffFlagged,
  maxSubcontractorPrice,
} from '@/lib/kosztorys/subcontractor-price-guard'
import type { ViewPricingT } from '@/lib/kosztorys/types'

// Client price 100 makes every threshold readable at a glance: próg 65 zł z narzędziami, 55,25 zł
// bez narzędzi, and the w_tools coefficient price meets its own exactly.
const row: ViewPricingT = {
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
  clientPrice: 100,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
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

const amount = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideValue: value,
})

describe('maxSubcontractorPrice', () => {
  it('to udział ceny klienta, inny na każdej płaszczyźnie', () => {
    expect(maxSubcontractorPrice(row, 'w_tools')).toBe(65)
    expect(maxSubcontractorPrice(row, 'own_tools')).toBe(55.25)
    expect(MAX_CLIENT_SHARE.w_tools).toBe(0.65)
    expect(MAX_CLIENT_SHARE.own_tools).toBe(0.5525)
  })
})

describe('clientShareCeilingLabel', () => {
  it('names the ceiling to the place it actually holds, without trailing zeros', () => {
    expect(clientShareCeilingLabel('w_tools')).toBe('65%')
    expect(clientShareCeilingLabel('own_tools')).toBe('55,25%')
  })
})

describe('checkSubcontractorPrice — próg 65% ceny klienta z narzędziami', () => {
  it('dokładnie na progu przechodzi', () => {
    expect(checkSubcontractorPrice(amount(65), 'w_tools')).toBeNull()
  })

  it('włos powyżej progu ostrzega, nie odrzuca, a komunikat nazywa maksimum', () => {
    expect(checkSubcontractorPrice(amount(65.02), 'w_tools')).toEqual({
      severity: 'warn',
      message: expect.stringContaining('65,00'),
    })
  })

  // A price landing on odd grosze (0.65 × 100.01) is retyped off the screen rounded to two decimals;
  // without the tolerance that floating-point remainder would be flagged for no visible reason.
  it('kwota przepisana z ekranu na sam próg nie jest odrzucana', () => {
    const odd = { ...amount(65.01), clientPrice: 100.01 }
    expect(checkSubcontractorPrice(odd, 'w_tools')).toBeNull()
  })

  it('własny mnożnik ponad próg ostrzega tym samym zdaniem co kwota', () => {
    const coeff = (value: number): ViewPricingT => ({ ...row, wToolsOverrideCoeff: value })

    expect(checkSubcontractorPrice(coeff(0.65), 'w_tools')).toBeNull()
    expect(checkSubcontractorPrice(coeff(0.7), 'w_tools')).toEqual(
      checkSubcontractorPrice(amount(70), 'w_tools'),
    )
  })
})

describe('checkSubcontractorPrice — tryb auto', () => {
  it('milczy: cena JEST stawką mnożnika', () => {
    expect(checkSubcontractorPrice(row, 'w_tools')).toBeNull()
    expect(checkSubcontractorPrice(row, 'own_tools')).toBeNull()
  })

  it('milczy także wtedy, gdy sam globalny mnożnik przekracza próg', () => {
    const over = { ...row, globalWToolsCoeff: 0.9 }
    expect(checkSubcontractorPrice(over, 'w_tools')).toBeNull()
  })

  it('odrzuca ujemną stawkę z auto — ujemny mnożnik', () => {
    const negative = { ...row, globalWToolsCoeff: -0.1 }
    expect(checkSubcontractorPrice(negative, 'w_tools')).toMatchObject({ severity: 'refuse' })
  })
})

describe('isCoeffFlagged / coeffWarning', () => {
  it('sam próg milczy, powyżej ostrzega', () => {
    expect(isCoeffFlagged(0.65, 'w_tools')).toBe(false)
    expect(coeffWarning(0.65, 'w_tools')).toBeNull()
    expect(isCoeffFlagged(0.9, 'w_tools')).toBe(true)
    expect(coeffWarning(0.9, 'w_tools')).toContain('65')
  })

  it('0,65 przechodzi z narzędziami, a bez narzędzi już nie', () => {
    expect(isCoeffFlagged(0.65, 'own_tools')).toBe(true)
    expect(coeffWarning(0.65, 'own_tools')).toContain('55')
    expect(isCoeffFlagged(0.5525, 'own_tools')).toBe(false)
  })

  it('zwykły mnożnik milczy', () => {
    expect(isCoeffFlagged(0.5, 'w_tools')).toBe(false)
    expect(coeffWarning(0.5, 'w_tools')).toBeNull()
  })

  it('zero ostrzega innym zdaniem niż próg', () => {
    expect(isCoeffFlagged(0, 'w_tools')).toBe(true)
    const zero = coeffWarning(0, 'w_tools')
    expect(zero).not.toBeNull()
    expect(zero).not.toEqual(coeffWarning(0.9, 'w_tools'))
  })

  it('ujemny mnożnik ostrzega trzecim zdaniem', () => {
    expect(isCoeffFlagged(-0.1, 'w_tools')).toBe(true)
    const negative = coeffWarning(-0.1, 'w_tools')
    expect(negative).not.toBeNull()
    expect(negative).not.toEqual(coeffWarning(0, 'w_tools'))
    expect(negative).not.toEqual(coeffWarning(0.9, 'w_tools'))
  })
})

describe('checkSubcontractorPrice — druga płaszczyzna narzędziowa', () => {
  const ownAmount = (value: number): ViewPricingT => ({
    ...row,
    ownToolsOverrideValue: value,
  })

  it('próg bez narzędzi jest niższy — 60 zł przechodziło, dziś ostrzega', () => {
    expect(checkSubcontractorPrice(ownAmount(55.25), 'own_tools')).toBeNull()
    expect(checkSubcontractorPrice(ownAmount(60), 'own_tools')).toMatchObject({ severity: 'warn' })
    expect(checkSubcontractorPrice(amount(60), 'w_tools')).toBeNull()
  })

  it('mierzy cenę TEJ płaszczyzny, nie sąsiedniej', () => {
    const overOnW = {
      ...ownAmount(50),
      wToolsOverrideValue: 90,
    }
    expect(checkSubcontractorPrice(overOnW, 'own_tools')).toBeNull()
    expect(checkSubcontractorPrice(overOnW, 'w_tools')).toMatchObject({ severity: 'warn' })
  })
})

describe('checkSubcontractorPrice — brak ceny klienta', () => {
  it('milczy przy cenie 0 i ujemnej — nie ma marży do zmierzenia', () => {
    expect(checkSubcontractorPrice({ ...amount(50), clientPrice: 0 }, 'w_tools')).toBeNull()
    expect(checkSubcontractorPrice({ ...amount(50), clientPrice: -10 }, 'w_tools')).toBeNull()
  })
})

describe('checkSubcontractorPrice — próg liczy się od ceny przed rabatem', () => {
  const rebated = (item: ViewPricingT): ViewPricingT => ({
    ...item,
    discountType: 'percent',
    discountValue: 50,
  })

  it('50% rabatu nie obniża progu — 64 zł nadal przechodzi', () => {
    expect(checkSubcontractorPrice(rebated(amount(64)), 'w_tools')).toBeNull()
  })

  it('próg zostaje na 65 zł, nie schodzi do 32,50 zł', () => {
    expect(maxSubcontractorPrice(rebated(row), 'w_tools')).toBe(65)
    expect(checkSubcontractorPrice(rebated(amount(66)), 'w_tools')).toMatchObject({
      severity: 'warn',
    })
  })
})

describe('checkSubcontractorPrice — cena ujemna', () => {
  it('jest odrzucana, nie tylko sygnalizowana', () => {
    expect(checkSubcontractorPrice(amount(-1), 'w_tools')).toMatchObject({ severity: 'refuse' })
  })

  it('jest odrzucana także tam, gdzie próg nie ma czego mierzyć', () => {
    expect(checkSubcontractorPrice({ ...amount(-50), clientPrice: 0 }, 'w_tools')).toMatchObject({
      severity: 'refuse',
    })
  })

  it('zero nie jest ujemne — darmowa pozycja to nie błąd', () => {
    expect(checkSubcontractorPrice(amount(0), 'w_tools')).toBeNull()
  })
})
