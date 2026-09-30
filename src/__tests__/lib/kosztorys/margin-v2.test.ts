import { describe, expect, it } from 'vitest'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { marginV2 } from '@/lib/kosztorys/margin-v2'
import { ZERO_FINANCIALS, type InvestmentFinancialsT } from '@/types/investment-financials'

const financials: InvestmentFinancialsT = {
  ...ZERO_FINANCIALS,
  totalLaborCosts: 1000,
  totalDiscount: 100,
  totalPayouts: 700,
  totalLoss: 50,
  totalSettled: 30,
  materialsNetDiscount: 20,
}

const settled = { due: 600, hasUnconfirmedPlane: false }

describe('marginV2', () => {
  it('robocizna minus rabat, należne podwykonawcom, materiał wliczony w robociznę i strata', () => {
    expect(marginV2(financials, settled)).toBe(220) // 1000 − 100 − 600 − 30 − 50
  })

  it('nie odejmuje obniżki materiałów', () => {
    const richer = { ...financials, materialsNetDiscount: 999 }
    expect(marginV2(richer, settled)).toBe(marginV2(financials, settled))
  })

  it('nie odejmuje wypłat — należne podwykonawcom zastępuje je, nie uzupełnia', () => {
    const paidNothing = { ...financials, totalPayouts: 0 }
    expect(marginV2(paidNothing, settled)).toBe(marginV2(financials, settled))
  })

  // The listing's należne is a Postgres numeric SUM, the investment page's a JS fold of qty × stawka:
  // 2.5 × 1125.89 is 2814.725 in one and 2814.7250000000004 in the other, which put the two surfaces
  // a grosz apart on a half-grosz marża.
  it('ta sama należność daje jedną marżę, czy zsumował ją Postgres, czy JS', () => {
    const revenue = { ...ZERO_FINANCIALS, totalLaborCosts: 5000 }
    const fromSql = marginV2(revenue, { due: 2814.725, hasUnconfirmedPlane: false })
    const fromFold = marginV2(revenue, { due: 2.5 * 1125.89, hasUnconfirmedPlane: false })
    expect(fromSql).toBe(2185.28)
    expect(fromFold).toBe(2185.28)
  })

  it('to inna figura niż stara marża, na tych samych danych', () => {
    expect(calculateMargin(financials)).toBe(100) // 1000 − 700 − 100 − 50 − 30 − 20
    expect(marginV2(financials, settled)).not.toBe(calculateMargin(financials))
  })

  // Owner's call (2026-08-18): an etap holding executed work with no settlement picked withholds
  // the figure. Zero would claim the work cost nothing.
  it.each([600, 0])('etap bez sposobu rozliczenia wstrzymuje figurę (należne %s)', (due) => {
    expect(marginV2(financials, { due, hasUnconfirmedPlane: true })).toBeNull()
  })

  it('pusta inwestycja to zero, nie null', () => {
    expect(marginV2(ZERO_FINANCIALS, { due: 0, hasUnconfirmedPlane: false })).toBe(0)
  })

  it('należne ponad robociznę daje ujemną marżę', () => {
    expect(marginV2(financials, { due: 1500, hasUnconfirmedPlane: false })).toBe(-680)
  })
})
