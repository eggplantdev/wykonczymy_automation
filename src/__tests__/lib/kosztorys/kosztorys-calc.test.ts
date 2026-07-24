import { describe, expect, it } from 'vitest'
import {
  globalDiscountAmount,
  isGlobalDiscountActive,
  netForQtyForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageDoneFraction,
  stageValueForView,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import type { ViewPricingT } from '@/lib/kosztorys/types'

// Subcontractor prices as an 'amount' override (flat 12/10) — preserves the values from before
// the migration to the coefficient model (the tests validate the amount path, not the derivation).
const item: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 10,
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
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

// Σ etapów, handed in by the settlement layer — here it happens to equal the fixture's 10.
const TOTAL_QTY = 10

describe('stageValueForView', () => {
  it('liczy wartość etapu wg ceny widoku', () => {
    expect(stageValueForView(item, 3, TOTAL_QTY, 'client')).toBe(60) // 3 × 20
    expect(stageValueForView(item, 3, TOTAL_QTY, 'w_tools')).toBe(36) // 3 × 12
    expect(stageValueForView(item, 3, TOTAL_QTY, 'own_tools')).toBe(30) // 3 × 10
  })

  it('uwzględnia rabat procentowy', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    expect(stageValueForView(discounted, 3, TOTAL_QTY, 'client')).toBe(54) // 60 − 10%
  })

  // Rabat kwotowy jest rabatem OD CAŁOŚCI wiersza (właściciel, 2026-07-15), więc etap niesie tylko
  // swój udział w nim — inaczej cały rabat schodziłby raz na KAŻDY etap. Arkusz nie rozstrzyga:
  // jego V = D*$Q-(D*$Q*$R) jest oparte o stawkę, czyli zna wyłącznie procent.
  describe('rabat kwotowy — rozkłada się proporcjonalnie do ilości etapu', () => {
    const discounted = { ...item, discountType: 'amount' as const, discountValue: 100 }
    // suma etapów 10 × cena 20 = 200 brutto; rabat 100 zł ⇒ netto 100

    it('etap bez postępu ma wartość 0, nie ujemną', () => {
      expect(stageValueForView(discounted, 0, TOTAL_QTY, 'client')).toBe(0)
    })

    it('etap niesie swój udział w rabacie', () => {
      expect(stageValueForView(discounted, 5, TOTAL_QTY, 'client')).toBe(50) // 100 − (100 × 5/10)
    })
  })
})

// The share's denominator is now the stage sum handed in from the settlement layer, not a field on
// the row: pomiar IS Σ stages, so a stage can only ever be a share of that sum.
describe('netForQtyForView / stageValueForView — share of the stage sum', () => {
  const totalQty = 8 // Σ etapów, deliberately ≠ plannedQty (10)

  for (const discount of [
    { discountType: 'percent' as const, discountValue: 10 },
    { discountType: 'amount' as const, discountValue: 40 },
  ]) {
    it(`wartości etapów sumują się do wartości sumy etapów — rabat ${discount.discountType}`, () => {
      const row = { ...item, ...discount }
      for (const view of ['client', 'w_tools', 'own_tools'] as const) {
        const parts = [5, 3, 0].map((qty) => stageValueForView(row, qty, totalQty, view))
        const sum = parts.reduce((acc, value) => acc + value, 0)
        expect(sum).toBeCloseTo(netForQtyForView(row, totalQty, view), 10)
      }
    })
  }

  it('suma etapów = 0 → wartość etapu 0, bez NaN/Infinity', () => {
    expect(stageValueForView(item, 0, 0, 'client')).toBe(0)
  })

  // A cleared cell writes null, which a `=== 0` guard would walk past into a divide.
  it('wyczyszczona suma etapów nie jest dzielnikiem', () => {
    expect(stageValueForView(item, 3, null as unknown as number, 'client')).toBe(0)
  })
})

describe('stageDoneFraction / rowDoneFraction', () => {
  // The denominator is the Przedmiar; the stage qty passed in is the numerator. They must differ, or
  // the fraction would pass even if it divided by the wrong one.
  const planned20 = { ...item, plannedQty: 20 }

  it('ułamek liczy się z Przedmiaru, nie z sumy etapów', () => {
    expect(rowDoneFraction(planned20, 19)).toBe(0.95) // 19 / 20
    expect(stageDoneFraction(planned20, 5)).toBe(0.25) // 5 / 20
  })

  it('fraction = stage qty / planned qty', () => {
    expect(stageDoneFraction(item, 3)).toBe(0.3) // 3 / 10
    expect(rowDoneFraction(item, 7)).toBe(0.7)
  })

  // The percent is a ratio of QUANTITIES, so neither the price view nor the rabat can move it —
  // otherwise "75%" would mean a different thing in each view, and the grid shows one figure.
  it('cena i rabat nie ruszają procentu', () => {
    for (const discounted of [
      { ...item, clientPrice: 999 },
      { ...item, discountType: 'percent' as const, discountValue: 10 },
      { ...item, discountType: 'amount' as const, discountValue: 40 },
    ]) {
      expect(stageDoneFraction(discounted, 3)).toBe(0.3)
      expect(rowDoneFraction(discounted, 7)).toBe(0.7)
    }
  })

  it('no planned qty → null (no denominator), never zero and never Infinity', () => {
    const noPlan = { ...item, plannedQty: 0 }
    expect(stageDoneFraction(noPlan, 3)).toBeNull()
    expect(rowDoneFraction(noPlan, 3)).toBeNull()
  })

  // Clearing the Przedmiar cell writes null, not 0 — the grid's float column is Column<number|null>,
  // and client row state holds that null until a refresh normalizes it. A `=== 0` guard falls
  // through and divides: 0/null → NaN → "NaN%", 3/null → Infinity → "∞%" in the always-visible cell.
  it('a cleared planned qty is a missing denominator too, not a divisor', () => {
    for (const empty of [null, undefined]) {
      const cleared = { ...item, plannedQty: empty as unknown as number }
      expect(stageDoneFraction(cleared, 3)).toBeNull()
      expect(stageDoneFraction(cleared, 0)).toBeNull()
      expect(rowDoneFraction(cleared, 3)).toBeNull()
    }
  })

  it('overshooting the planned qty passes through unclamped — it signals bad data', () => {
    expect(stageDoneFraction(item, 12)).toBe(1.2)
    expect(rowDoneFraction(item, 15)).toBe(1.5)
  })
})

describe('rowPlannedNetForView', () => {
  // The fixture's plannedQty === the stage sum, which would pass even if the formula read the wrong
  // one — every case here must drive them apart.
  const planned12 = { ...item, plannedQty: 12 }

  it('liczy z przedmiaru, nie z sumy etapów', () => {
    expect(rowPlannedNetForView(planned12, 'client')).toBe(240) // 12 × 20
    expect(netForQtyForView(planned12, TOTAL_QTY, 'client')).toBe(200) // 10 × 20 — suma etapów
  })

  it('wg ceny aktywnego widoku', () => {
    expect(rowPlannedNetForView(planned12, 'w_tools')).toBe(144) // 12 × 12
    expect(rowPlannedNetForView(planned12, 'own_tools')).toBe(120) // 12 × 10
  })

  // The owner's call (2026-07-16, EX-494 follow-up): the offer figure carries the rabat, matching the
  // sheet's S = N×Q − N×Q×R. This is the single guardian of that decision — asserted outright, not
  // derived from an invariant. Flagged a "small question mark" by the owner: a revert is one commit.
  it('rabat procentowy wchodzi w wartość przedmiaru', () => {
    const discounted = { ...planned12, discountType: 'percent' as const, discountValue: 10 }
    expect(rowPlannedNetForView(discounted, 'client')).toBe(216) // 240 − 10%
  })

  it('rabat kwotowy wchodzi w wartość przedmiaru', () => {
    const discounted = { ...planned12, discountType: 'amount' as const, discountValue: 30 }
    expect(rowPlannedNetForView(discounted, 'client')).toBe(210) // 240 − 30
  })
})

// A flat 'amount' rabat is a fixed subtraction, so at qty 0 applyDiscount(0) would return
// −discountValue — a row priced at zero quantity reading negative. Zero quantity is worth zero; the
// flat rabat has nothing to come off of. 'percent' (0 × (1−x) = 0) is already safe, but the guard
// covers both, and it keeps rowPlannedNetForView (przedmiar 0) and rowValueForView (no stages) at 0.
describe('netForQtyForView — zerowa ilość nie niesie wartości ani rabatu', () => {
  it('rabat kwotowy przy zerowej ilości → 0, nie ujemna', () => {
    const discounted = { ...item, discountType: 'amount' as const, discountValue: 500 }
    expect(netForQtyForView(discounted, 0, 'client')).toBe(0)
  })

  it('rabat procentowy przy zerowej ilości → 0', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    expect(netForQtyForView(discounted, 0, 'client')).toBe(0)
  })
})

// Brutto is the grid's read-only Brutto column + Suma brutto: gross = net × (1 + vatRate), on the
// post-discount net (netForQtyForView already subtracts the discount). One rate per investment.
const gross = (row: ViewPricingT, view: PriceViewT, vatRate: number) =>
  netForQtyForView(row, TOTAL_QTY, view) * (1 + vatRate)

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

  it('wartość przedmiaru brutto = wartość przedmiaru netto × (1 + VAT), rabat w kwocie', () => {
    const discounted = {
      ...item,
      plannedQty: 12,
      discountType: 'percent' as const,
      discountValue: 10,
    }
    // planned net = 12 × 20 − 10% = 216 → brutto 216 × 1.08 = 233.28
    expect(rowPlannedNetForView(discounted, 'client') * 1.08).toBeCloseTo(233.28, 10)
  })
})

// Global (whole-kosztorys) discount OVERRIDES per-item rabat: when it is active, every row prices
// gross-of-its-own-rabat (the per-item discount stays in the DB but stops applying), and the global
// discount is subtracted once at the total level — never distributed onto rows/stages.
describe('rabat globalny — nadpisuje rabat per pozycja', () => {
  it('aktywny globalny rabat → wiersz liczy się bez własnego rabatu (przedmiar i wykonanie)', () => {
    for (const perItem of [
      { discountType: 'percent' as const, discountValue: 10 },
      { discountType: 'amount' as const, discountValue: 50 },
    ]) {
      const row = { ...item, plannedQty: 12, ...perItem, globalDiscountActive: true }
      // Gross of its own rabat: przedmiar 12 × 20 = 240, wykonanie Σetapów 10 × 20 = 200.
      expect(rowPlannedNetForView(row, 'client')).toBe(240)
      expect(netForQtyForView(row, TOTAL_QTY, 'client')).toBe(200)
      expect(stageValueForView(row, 5, TOTAL_QTY, 'client')).toBe(100) // 200 × 5/10, no rabat
    }
  })

  it('nieaktywny globalny rabat → rabat per pozycja liczy normalnie', () => {
    const row = { ...item, discountType: 'percent' as const, discountValue: 10 }
    expect(netForQtyForView(row, TOTAL_QTY, 'client')).toBe(180) // 200 − 10%
  })
})

// The discount amount off the executed total, and "do zapłaty" = total − amount. Single source both
// total surfaces share (Sekcje Suma block + totals bar). Not clamped below zero.
describe('globalDiscountAmount / do zapłaty', () => {
  it('procent skaluje sumę', () => {
    expect(globalDiscountAmount(1000, { type: 'percent', value: 10 })).toBe(100)
  })

  it('kwota jest płaska', () => {
    expect(globalDiscountAmount(1000, { type: 'amount', value: 250 })).toBe(250)
  })

  it('brak rabatu / zero → 0', () => {
    expect(globalDiscountAmount(1000, { type: null, value: 0 })).toBe(0)
    expect(globalDiscountAmount(1000, { type: 'percent', value: 0 })).toBe(0)
    expect(globalDiscountAmount(1000, { type: 'amount', value: 0 })).toBe(0)
  })

  it('do zapłaty = suma − rabat', () => {
    const totalNet = 1000
    expect(totalNet - globalDiscountAmount(totalNet, { type: 'percent', value: 10 })).toBe(900)
    expect(totalNet - globalDiscountAmount(totalNet, { type: 'amount', value: 250 })).toBe(750)
  })
})

describe('isGlobalDiscountActive', () => {
  it('aktywny tylko dla znanego trybu z niezerową wartością', () => {
    expect(isGlobalDiscountActive({ type: 'percent', value: 10 })).toBe(true)
    expect(isGlobalDiscountActive({ type: 'amount', value: 250 })).toBe(true)
  })

  it('brak trybu lub zerowa wartość → nieaktywny', () => {
    expect(isGlobalDiscountActive({ type: null, value: 0 })).toBe(false)
    expect(isGlobalDiscountActive({ type: 'percent', value: 0 })).toBe(false)
    expect(isGlobalDiscountActive({ type: null, value: 500 })).toBe(false)
  })

  it('nieznany, uszkodzony tryb → fail closed (nieaktywny)', () => {
    // A persisted value that isn't 'percent'/'amount' (tolerant restore / out-of-band write) must
    // NOT go active — otherwise per-item rabat is suppressed while nothing is subtracted.
    expect(isGlobalDiscountActive({ type: 'bogus' as never, value: 100 })).toBe(false)
  })
})
