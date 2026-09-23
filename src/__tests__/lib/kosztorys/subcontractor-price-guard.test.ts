import { describe, expect, it } from 'vitest'
import {
  MAX_CLIENT_SHARE,
  checkSubcontractorPrice,
  coeffWarning,
  isCoeffFlagged,
  maxSubcontractorPrice,
} from '@/lib/kosztorys/subcontractor-price-guard'
import type { ViewPricingT } from '@/lib/kosztorys/types'

// Client price 100 makes every threshold readable at a glance: ceiling 65, which the w_tools
// coefficient price meets exactly; own_tools lands at 55.
const row: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
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
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

const amount = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideValue: value,
})

describe('maxSubcontractorPrice', () => {
  it('to udział ceny klienta', () => {
    expect(maxSubcontractorPrice(row)).toBe(65)
    expect(MAX_CLIENT_SHARE).toBe(0.65)
  })
})

describe('checkSubcontractorPrice — sufit 65% ceny klienta', () => {
  it('dokładnie na suficie przechodzi', () => {
    expect(checkSubcontractorPrice(amount(65), 'w_tools')).toBeNull()
  })

  it('włos powyżej sufitu ostrzega, nie odrzuca, a komunikat nazywa maksimum', () => {
    expect(checkSubcontractorPrice(amount(65.02), 'w_tools')).toEqual({
      severity: 'warn',
      message: expect.stringContaining('65,00'),
    })
  })

  // A price landing on odd grosze (0.65 × 100.01) is retyped off the screen rounded to two decimals;
  // without the tolerance that floating-point remainder would be flagged for no visible reason.
  it('kwota przepisana z ekranu na sam sufit nie jest odrzucana', () => {
    const odd = { ...amount(65.01), clientPrice: 100.01 }
    expect(checkSubcontractorPrice(odd, 'w_tools')).toBeNull()
  })
})

describe('checkSubcontractorPrice — tryb auto', () => {
  it('milczy: cena JEST stawką mnożnika', () => {
    expect(checkSubcontractorPrice(row, 'w_tools')).toBeNull()
    expect(checkSubcontractorPrice(row, 'own_tools')).toBeNull()
  })

  // Reversed 2026-09-22: judging the derived figure judged the mnożnik once per pozycja, so one
  // keystroke in the pasku threw a whole rozpiska over the ceiling. The mnożnik answers for itself —
  // see `coeffWarning` below.
  it('milczy także wtedy, gdy sam globalny mnożnik przekracza sufit', () => {
    const over = { ...row, globalWToolsCoeff: 0.9 }
    expect(checkSubcontractorPrice(over, 'w_tools')).toBeNull()
  })

  // The ceiling rung is gated on „kwota stała"; the negative rung is not, because a negative mnożnik
  // is reachable through the action (`investmentCoeffsSchema` carries no `.min(0)`).
  it('odrzuca ujemną stawkę z auto — ujemny mnożnik', () => {
    const negative = { ...row, globalWToolsCoeff: -0.1 }
    expect(checkSubcontractorPrice(negative, 'w_tools')).toMatchObject({ severity: 'refuse' })
  })
})

describe('isCoeffFlagged / coeffWarning', () => {
  it('sam sufit milczy, powyżej ostrzega', () => {
    expect(isCoeffFlagged(0.65)).toBe(false)
    expect(coeffWarning(0.65)).toBeNull()
    expect(isCoeffFlagged(0.9)).toBe(true)
    expect(coeffWarning(0.9)).toContain('65')
  })

  it('zwykły mnożnik milczy', () => {
    expect(isCoeffFlagged(0.5)).toBe(false)
    expect(coeffWarning(0.5)).toBeNull()
  })

  it('zero ostrzega innym zdaniem niż sufit', () => {
    expect(isCoeffFlagged(0)).toBe(true)
    const zero = coeffWarning(0)
    expect(zero).not.toBeNull()
    expect(zero).not.toEqual(coeffWarning(0.9))
  })

  // The rung the mnożnik field was still silent on. A negative mnożnik is refused row by row, so
  // „Problemy" fills with one verdict repeated per pozycja — the flood this whole gate exists to
  // stop — while the single field that caused it renders as if nothing were wrong.
  it('ujemny mnożnik ostrzega trzecim zdaniem', () => {
    expect(isCoeffFlagged(-0.1)).toBe(true)
    const negative = coeffWarning(-0.1)
    expect(negative).not.toBeNull()
    expect(negative).not.toEqual(coeffWarning(0))
    expect(negative).not.toEqual(coeffWarning(0.9))
  })
})

describe('checkSubcontractorPrice — druga płaszczyzna narzędziowa', () => {
  const ownAmount = (value: number): ViewPricingT => ({
    ...row,
    ownToolsOverrideValue: value,
  })

  it('sufit jest ten sam na obu płaszczyznach', () => {
    expect(checkSubcontractorPrice(ownAmount(66), 'own_tools')).toMatchObject({ severity: 'warn' })
    expect(checkSubcontractorPrice(ownAmount(65), 'own_tools')).toBeNull()
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

describe('checkSubcontractorPrice — sufit liczy się od ceny przed rabatem', () => {
  // The rabat is the company giving away part of its own cut. If it dragged the ceiling down, a
  // discount would retroactively re-price the subcontractor, who never agreed to fund it.
  const rebated = (item: ViewPricingT): ViewPricingT => ({
    ...item,
    discountType: 'percent',
    discountValue: 50,
  })

  it('50% rabatu nie obniża sufitu — 64 zł nadal przechodzi', () => {
    expect(checkSubcontractorPrice(rebated(amount(64)), 'w_tools')).toBeNull()
  })

  it('sufit zostaje na 65 zł, nie schodzi do 32,50 zł', () => {
    expect(maxSubcontractorPrice(rebated(row))).toBe(65)
    expect(checkSubcontractorPrice(rebated(amount(66)), 'w_tools')).toMatchObject({
      severity: 'warn',
    })
  })
})

describe('checkSubcontractorPrice — cena ujemna', () => {
  it('jest odrzucana, nie tylko sygnalizowana', () => {
    expect(checkSubcontractorPrice(amount(-1), 'w_tools')).toMatchObject({ severity: 'refuse' })
  })

  it('jest odrzucana także tam, gdzie sufit nie ma czego mierzyć', () => {
    // The zero-client-price short-circuit silences the ceiling, so without its own rung a negative
    // price would pass unremarked on exactly the rows that are still being priced.
    expect(checkSubcontractorPrice({ ...amount(-50), clientPrice: 0 }, 'w_tools')).toMatchObject({
      severity: 'refuse',
    })
  })

  it('zero nie jest ujemne — darmowa pozycja to nie błąd', () => {
    expect(checkSubcontractorPrice(amount(0), 'w_tools')).toBeNull()
  })
})
