import { describe, it, expect } from 'vitest'
import { discountNetFromGross, toGross, toNet } from '@/lib/kosztorys/calc'
import { roundToCents } from '@/lib/utils/round-to-cents'

const shownGross = (stored: number, vatRate: number) => roundToCents(toGross(stored, vatRate))

describe('rabat kwotowy wpisany w brutto', () => {
  it.each([0, 0.05, 0.08, 0.23])('wraca do wpisanej kwoty brutto przy VAT %s', (vatRate) => {
    for (let grosze = 0; grosze <= 10_000_000; grosze += 997) {
      const gross = grosze / 100
      expect(shownGross(discountNetFromGross(gross, vatRate), vatRate)).toBe(gross)
    }
  })

  // Kwoty where a netto rounded to grosze re-grosses one grosz off — the reason storage is six places.
  it.each([
    [0.1, 0.05],
    [0.07, 0.08],
    [0.03, 0.23],
  ])('%s zł brutto przy VAT %s nie gubi grosza', (gross, vatRate) => {
    expect(shownGross(roundToCents(toNet(gross, vatRate)), vatRate)).not.toBe(gross)
    expect(shownGross(discountNetFromGross(gross, vatRate), vatRate)).toBe(gross)
  })

  it('5000 zł brutto przy 8% to 4629,63 zł netto', () => {
    const stored = discountNetFromGross(5000, 0.08)
    expect(roundToCents(stored)).toBe(4629.63)
    expect(shownGross(stored, 0.08)).toBe(5000)
  })
})
