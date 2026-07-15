import { describe, expect, it } from 'vitest'
import {
  rowNetForView,
  rowPlannedNetForView,
  rowRemainingForView,
  sectionSubtotalsForView,
  stageValueForView,
} from '@/lib/kosztorys/calc'
import type { KosztorysV2RowT, ViewPricingT } from '@/types/kosztorys'

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

describe('rowRemainingForView', () => {
  it('pozostało = netto widoku − wykonane', () => {
    // client net = 10 × 20 = 200; done = 60 → remaining 140
    expect(rowRemainingForView(item, 60, 'client')).toBe(140)
    // w_tools net = 10 × 12 = 120; done = 36 → remaining 84
    expect(rowRemainingForView(item, 36, 'w_tools')).toBe(84)
  })

  it('over-completion → ujemne pozostało (etapy przekraczają netto)', () => {
    // client net = 200; done across stages = 380 → remaining −180. The editor renders this
    // negative value verbatim (manual check 4.7), it is not clamped to 0.
    expect(rowRemainingForView(item, 380, 'client')).toBe(-180)
  })

  it('pozostało uwzględnia rabat kwotowy w netto widoku', () => {
    // amount discount 30: client net = 10 × 20 − 30 = 170; done 50 → remaining 120
    const discounted = { ...item, discountType: 'amount' as const, discountValue: 30 }
    expect(rowRemainingForView(discounted, 50, 'client')).toBe(120)
  })
})

// fixture: 2 sections, A (id 10) has 2 items, B (id 20) has 1 item
const v2Rows: KosztorysV2RowT[] = [
  {
    ...item,
    id: 1,
    sectionId: 10,
    sectionName: 'Sekcja A',
    vatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
  },
  {
    ...item,
    id: 2,
    sectionId: 10,
    sectionName: 'Sekcja A',
    vatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
    measuredQty: 5,
    clientPrice: 10,
    discountType: 'percent',
    discountValue: 20, // 5×10 = 50 − 20% = 40
  },
  {
    ...item,
    id: 3,
    sectionId: 20,
    sectionName: 'Sekcja B',
    vatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
    clientPrice: 100, // 10×100 = 1000
  },
]

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

describe('sectionSubtotalsForView', () => {
  it('sumuje netto per sekcja, nie miesza sekcji', () => {
    const r = sectionSubtotalsForView(v2Rows, 'client')
    // Section A: item1 10×20=200 + item2 40 = 240; Section B: 1000
    expect(r.map((s) => [s.sectionId, s.net, s.itemCount])).toEqual([
      [10, 240, 2],
      [20, 1000, 1],
    ])
  })

  it('view-awareness: w_tools daje inne netto', () => {
    const r = sectionSubtotalsForView(v2Rows, 'w_tools')
    // item1 10×12=120; item2 5×12=60 −20% = 48 → A=168; B 10×12=120
    expect(r[0].net).toBe(168)
    expect(r[1].net).toBe(120)
  })

  it('share sumuje do ~1 gdy grandNet > 0', () => {
    const r = sectionSubtotalsForView(v2Rows, 'client')
    expect(r.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10)
    expect(r[1].share).toBeCloseTo(1000 / 1240, 10)
  })

  it('guard: grandNet = 0 → share 0, bez NaN', () => {
    const zero = v2Rows.map((row) => ({ ...row, clientPrice: 0 }))
    const r = sectionSubtotalsForView(zero, 'client')
    expect(r.every((s) => s.share === 0)).toBe(true)
  })
})
