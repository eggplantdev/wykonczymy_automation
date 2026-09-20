import { describe, expect, it } from 'vitest'
import {
  MAX_CLIENT_SHARE,
  checkSubcontractorPrice,
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

  it('włos powyżej sufitu jest odrzucany, a komunikat nazywa maksimum', () => {
    expect(checkSubcontractorPrice(amount(65.02), 'w_tools')).toContain('65,00')
  })

  // A price landing on odd grosze (0.65 × 100.01) is retyped off the screen rounded to two decimals;
  // without the tolerance that floating-point remainder would be refused for no visible reason.
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

  it('odrzuca, gdy sam globalny mnożnik przekracza sufit', () => {
    const over = { ...row, globalWToolsCoeff: 0.9 }
    expect(checkSubcontractorPrice(over, 'w_tools')).not.toBeNull()
  })
})

describe('checkSubcontractorPrice — druga płaszczyzna narzędziowa', () => {
  const ownAmount = (value: number): ViewPricingT => ({
    ...row,
    ownToolsOverrideValue: value,
  })

  it('sufit jest ten sam na obu płaszczyznach', () => {
    expect(checkSubcontractorPrice(ownAmount(66), 'own_tools')).not.toBeNull()
    expect(checkSubcontractorPrice(ownAmount(65), 'own_tools')).toBeNull()
  })

  it('mierzy cenę TEJ płaszczyzny, nie sąsiedniej', () => {
    const overOnW = {
      ...ownAmount(50),
      wToolsOverrideValue: 90,
    }
    expect(checkSubcontractorPrice(overOnW, 'own_tools')).toBeNull()
    expect(checkSubcontractorPrice(overOnW, 'w_tools')).not.toBeNull()
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
    expect(checkSubcontractorPrice(rebated(amount(66)), 'w_tools')).not.toBeNull()
  })
})

describe('checkSubcontractorPrice — cena ujemna', () => {
  it('jest odrzucana', () => {
    expect(checkSubcontractorPrice(amount(-1), 'w_tools')).not.toBeNull()
  })

  it('jest odrzucana także tam, gdzie sufit nie ma czego mierzyć', () => {
    // The zero-client-price short-circuit silences the ceiling, so without its own rung a negative
    // price would pass unremarked on exactly the rows that are still being priced.
    expect(checkSubcontractorPrice({ ...amount(-50), clientPrice: 0 }, 'w_tools')).not.toBeNull()
  })

  it('zero nie jest ujemne — darmowa pozycja to nie błąd', () => {
    expect(checkSubcontractorPrice(amount(0), 'w_tools')).toBeNull()
  })
})
