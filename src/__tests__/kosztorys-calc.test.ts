import { describe, expect, it } from 'vitest'
import {
  rowDoneFraction,
  rowNetForView,
  rowPlannedNetForView,
  stageDoneFraction,
  stageValueForView,
} from '@/lib/kosztorys/calc'
import type { ViewPricingT } from '@/types/kosztorys'

// Subcontractor prices as an 'amount' override (flat 12/10) — preserves the values from before
// the migration to the coefficient model (the tests validate the amount path, not the derivation).
const item: ViewPricingT = {
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
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: 12,
  ownToolsOverrideType: 'amount',
  ownToolsOverrideValue: 10,
  costVariant: null,
  hiddenInExport: false,
  note: null,
  sectionWToolsCoeff: null,
  sectionOwnToolsCoeff: null,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
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

  // Rabat kwotowy jest rabatem OD CAŁOŚCI wiersza (właściciel, 2026-07-15), więc etap niesie tylko
  // swój udział w nim — inaczej cały rabat schodziłby raz na KAŻDY etap. Arkusz nie rozstrzyga:
  // jego V = D*$Q-(D*$Q*$R) jest oparte o stawkę, czyli zna wyłącznie procent.
  describe('rabat kwotowy — rozkłada się proporcjonalnie do ilości etapu', () => {
    const discounted = { ...item, discountType: 'amount' as const, discountValue: 100 }
    // pomiar 10 × cena 20 = 200 brutto; rabat 100 zł ⇒ netto 100

    it('etap bez postępu ma wartość 0, nie ujemną', () => {
      expect(stageValueForView(discounted, 0, 'client')).toBe(0)
    })

    it('etap niesie swój udział w rabacie', () => {
      expect(stageValueForView(discounted, 5, 'client')).toBe(50) // 100 − (100 × 5/10)
    })

    it('wartości etapów sumują się do netto wiersza', () => {
      const stages = [5, 5, 0].map((qty) => stageValueForView(discounted, qty, 'client'))
      const sum = stages.reduce((acc, value) => acc + value, 0)
      expect(sum).toBeCloseTo(rowNetForView(discounted, 'client'), 10)
    })

    it('rekoncyliacja trzyma się w widokach podwykonawcy', () => {
      for (const view of ['w_tools', 'own_tools'] as const) {
        const stages = [3, 7].map((qty) => stageValueForView(discounted, qty, view))
        const sum = stages.reduce((acc, value) => acc + value, 0)
        expect(sum).toBeCloseTo(rowNetForView(discounted, view), 10)
      }
    })

    // Dzielenie przez pomiar: bez strażnika etap na wierszu bez pomiaru dałby NaN/Infinity w komórce.
    it('nie dzieli przez zero przy pustym pomiarze', () => {
      const noMeasure = { ...discounted, measuredQty: 0 }
      expect(Number.isFinite(stageValueForView(noMeasure, 3, 'client'))).toBe(true)
    })
  })
})

describe('stageDoneFraction / rowDoneFraction', () => {
  it('fraction = stage qty / measured qty', () => {
    expect(stageDoneFraction(item, 3)).toBe(0.3) // 3 / 10
    expect(rowDoneFraction(item, 7)).toBe(0.7)
  })

  // The whole reason the fraction is computed from QUANTITIES: price and discount cancel out in the
  // share, so one percentage holds across every view — otherwise "75%" would mean a different thing
  // in each of them.
  it('agrees with the value share — discount included', () => {
    for (const discounted of [
      item,
      { ...item, discountType: 'percent' as const, discountValue: 10 },
      // 40, not 100: an amount discount at/over a view's gross drives that view's net to 0, and the
      // value share then has no denominator — the quantity fraction still holds, which is the point.
      { ...item, discountType: 'amount' as const, discountValue: 40 },
    ]) {
      for (const view of ['client', 'w_tools', 'own_tools'] as const) {
        const valueShare = stageValueForView(discounted, 3, view) / rowNetForView(discounted, view)
        expect(stageDoneFraction(discounted, 3)).toBeCloseTo(valueShare, 10)
      }
    }
  })

  it('no measured qty → null (no denominator), never zero and never Infinity', () => {
    const noMeasure = { ...item, measuredQty: 0 }
    expect(stageDoneFraction(noMeasure, 3)).toBeNull()
    expect(rowDoneFraction(noMeasure, 3)).toBeNull()
  })

  // Clearing the Pomiar cell writes null, not 0 — the grid's float column is Column<number|null>,
  // and client row state holds that null until a refresh normalizes it. A `=== 0` guard falls
  // through and divides: 0/null → NaN → "NaN%", 3/null → Infinity → "∞%" in the always-visible cell.
  it('a cleared measured qty is a missing denominator too, not a divisor', () => {
    for (const empty of [null, undefined]) {
      const cleared = { ...item, measuredQty: empty as unknown as number }
      expect(stageDoneFraction(cleared, 3)).toBeNull()
      expect(stageDoneFraction(cleared, 0)).toBeNull()
      expect(rowDoneFraction(cleared, 3)).toBeNull()
    }
  })

  it('overshooting the measured qty passes through unclamped — it signals bad data', () => {
    expect(stageDoneFraction(item, 12)).toBe(1.2)
    expect(rowDoneFraction(item, 15)).toBe(1.5)
  })
})

describe('rowPlannedNetForView', () => {
  // The fixture's plannedQty === measuredQty, which would pass even if the formula read the wrong
  // one — every case here must drive them apart.
  const planned12 = { ...item, plannedQty: 12, measuredQty: 10 }

  it('liczy z przedmiaru, nie z pomiaru', () => {
    expect(rowPlannedNetForView(planned12, 'client')).toBe(240) // 12 × 20
    expect(rowNetForView(planned12, 'client')).toBe(200) // 10 × 20 — pomiar
  })

  it('wg ceny aktywnego widoku', () => {
    expect(rowPlannedNetForView(planned12, 'w_tools')).toBe(144) // 12 × 12
    expect(rowPlannedNetForView(planned12, 'own_tools')).toBe(120) // 12 × 10
  })

  // The owner's call (2026-07-15): przedmiar is the pre-negotiation valuation, so rabat must not
  // touch it — it lands only at settlement (Netto). This asymmetry with rowNetForView is the whole
  // point of the column and is the thing most likely to get "fixed" back by mistake.
  it('rabat procentowy NIE rusza wartości przedmiaru, rusza tylko netto', () => {
    const discounted = { ...planned12, discountType: 'percent' as const, discountValue: 10 }
    expect(rowPlannedNetForView(discounted, 'client')).toBe(240) // bez zmian
    expect(rowNetForView(discounted, 'client')).toBe(180) // 200 − 10%
  })

  it('rabat kwotowy NIE rusza wartości przedmiaru, rusza tylko netto', () => {
    const discounted = { ...planned12, discountType: 'amount' as const, discountValue: 30 }
    expect(rowPlannedNetForView(discounted, 'client')).toBe(240) // bez zmian
    expect(rowNetForView(discounted, 'client')).toBe(170) // 200 − 30
  })
})

// Brutto is the grid's read-only Brutto column + Suma brutto: gross = net × (1 + vatRate), on the
// post-discount net (rowNetForView already subtracts the discount). One rate per investment.
const gross = (row: ViewPricingT, view: Parameters<typeof rowNetForView>[1], vatRate: number) =>
  rowNetForView(row, view) * (1 + vatRate)

describe('brutto = netto × (1 + vatRate)', () => {
  it('plain row, 8%', () => {
    // client net = 10 × 20 = 200 → brutto 216
    expect(gross(item, 'client', 0.08)).toBeCloseTo(216, 10)
  })

  it('post-discount net (VAT on the discounted amount)', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    // net = 200 − 10% = 180 → brutto 180 × 1.08 = 194.4
    expect(gross(discounted, 'client', 0.08)).toBeCloseTo(194.4, 10)
  })

  it('consistent across price views (VAT on the active net)', () => {
    // w_tools net = 10 × 12 = 120 → 129.6; own_tools net = 10 × 10 = 100 → 108
    expect(gross(item, 'w_tools', 0.08)).toBeCloseTo(129.6, 10)
    expect(gross(item, 'own_tools', 0.08)).toBeCloseTo(108, 10)
  })

  it('23% rate', () => {
    expect(gross(item, 'client', 0.23)).toBeCloseTo(246, 10)
  })

  it('wartość przedmiaru brutto = wartość przedmiaru netto × (1 + VAT), rabat bez wpływu', () => {
    const discounted = {
      ...item,
      plannedQty: 12,
      discountType: 'percent' as const,
      discountValue: 10,
    }
    // planned net = 12 × 20 = 240 (rabat nie wchodzi) → brutto 240 × 1.08 = 259.2
    expect(rowPlannedNetForView(discounted, 'client') * 1.08).toBeCloseTo(259.2, 10)
  })
})
