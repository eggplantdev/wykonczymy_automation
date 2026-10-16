import { describe, expect, it } from 'vitest'
import {
  globalDiscountAmount,
  subcontractorPrice,
  globalDiscountForMode,
  isGlobalDiscountActive,
  netForQtyForView,
  priceSourceOf,
  rowCurrentPlannedNetForView,
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  rowPlannedNetPreDiscountForView,
  stageValueForView,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
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

const TOTAL_QTY = 10

// „Auto" and the mnożnik are the same arithmetic over two different coefficients, so every
// case here has to separate them: the fixture's globals are 0,65 / 0,55 and no mnożnik below reuses
// either number.
describe('subcontractorPrice — trzy źródła stawki', () => {
  const auto = { ...item, wToolsOverrideValue: null, ownToolsOverrideValue: null }

  it('bez nadpisania liczy z globalnego współczynnika inwestycji', () => {
    expect(subcontractorPrice(auto, 'w_tools')).toBeCloseTo(13, 10) // 20 × 0,65
    expect(subcontractorPrice(auto, 'own_tools')).toBeCloseTo(11, 10) // 20 × 0,55
  })

  it('kwota stała jest kwotą — cena j.m. jej nie rusza', () => {
    expect(subcontractorPrice(item, 'w_tools')).toBe(12)
    expect(subcontractorPrice({ ...item, clientPrice: 999 }, 'w_tools')).toBe(12)
  })

  it('mnożnik liczy się od ceny j.m. i podąża za nią — to czego kwota stała nie potrafi', () => {
    const row = { ...auto, wToolsOverrideCoeff: 0.8, ownToolsOverrideCoeff: 0.4 }
    expect(subcontractorPrice(row, 'w_tools')).toBeCloseTo(16, 10) // 20 × 0,8
    expect(subcontractorPrice(row, 'own_tools')).toBeCloseTo(8, 10) // 20 × 0,4
    expect(subcontractorPrice({ ...row, clientPrice: 50 }, 'w_tools')).toBeCloseTo(40, 10)
  })

  it('płaszczyzny są niezależne — mnożnik na jednej nie rusza drugiej', () => {
    const row = { ...auto, wToolsOverrideCoeff: 0.8 }
    expect(subcontractorPrice(row, 'w_tools')).toBeCloseTo(16, 10)
    expect(subcontractorPrice(row, 'own_tools')).toBeCloseTo(11, 10) // wciąż „auto"
  })

  it('mnożnik 0 to stawka zero złotych, nie „auto"', () => {
    expect(subcontractorPrice({ ...auto, wToolsOverrideCoeff: 0 }, 'w_tools')).toBe(0)
  })

  it('cena j.m. 0 zeruje stawkę z mnożnika, bez NaN', () => {
    const row = { ...auto, clientPrice: 0, wToolsOverrideCoeff: 0.8 }
    expect(subcontractorPrice(row, 'w_tools')).toBe(0)
  })

  it('ujemny mnożnik przechodzi wprost — to sygnał złych danych, nie miejsce na clamp', () => {
    expect(subcontractorPrice({ ...auto, wToolsOverrideCoeff: -0.5 }, 'w_tools')).toBeCloseTo(
      -10,
      10,
    )
  })

  // Nieosiągalne przez aplikację (akcja normalizuje każdy zapis), ale surowy SQL i /admin tam sięgają.
  it('wiersz z OBIEMA kolumnami wycenia się po mnożniku i nie rzuca', () => {
    const both = { ...item, wToolsOverrideValue: 12, wToolsOverrideCoeff: 0.8 }
    expect(subcontractorPrice(both, 'w_tools')).toBeCloseTo(16, 10)
    expect(priceSourceOf(both, 'w_tools')).toBe('coeff')
  })
})

describe('priceSourceOf — jedno miejsce decydujące o pierwszeństwie', () => {
  const auto = { ...item, wToolsOverrideValue: null, ownToolsOverrideValue: null }

  it('brak obu kolumn → „auto"', () => {
    expect(priceSourceOf(auto, 'w_tools')).toBe('auto')
    expect(priceSourceOf(auto, 'own_tools')).toBe('auto')
  })

  it('sama kwota → „amount", zero też', () => {
    expect(priceSourceOf(item, 'w_tools')).toBe('amount')
    expect(priceSourceOf({ ...auto, wToolsOverrideValue: 0 }, 'w_tools')).toBe('amount')
  })

  it('mnożnik → „coeff", zero też', () => {
    expect(priceSourceOf({ ...auto, wToolsOverrideCoeff: 0.8 }, 'w_tools')).toBe('coeff')
    expect(priceSourceOf({ ...auto, wToolsOverrideCoeff: 0 }, 'w_tools')).toBe('coeff')
  })

  it('czyta płaszczyznę, o którą pytano', () => {
    const row = { ...auto, ownToolsOverrideCoeff: 0.4 }
    expect(priceSourceOf(row, 'own_tools')).toBe('coeff')
    expect(priceSourceOf(row, 'w_tools')).toBe('auto')
  })

  it('brakująca kolumna i NaN spadają na „auto"', () => {
    const { wToolsOverrideCoeff: _coeff, wToolsOverrideValue: _value, ...missing } = auto
    expect(priceSourceOf(missing as typeof auto, 'w_tools')).toBe('auto')
    expect(priceSourceOf({ ...auto, wToolsOverrideCoeff: NaN }, 'w_tools')).toBe('auto')
    expect(priceSourceOf({ ...auto, wToolsOverrideValue: NaN }, 'w_tools')).toBe('auto')
  })
})

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

  describe('rabat kwotowy — rozkłada się proporcjonalnie do ilości etapu', () => {
    const discounted = { ...item, discountType: 'amount' as const, discountValue: 100 }

    it('etap bez postępu ma wartość 0, nie ujemną', () => {
      expect(stageValueForView(discounted, 0, TOTAL_QTY, 'client')).toBe(0)
    })

    it('etap niesie swój udział w rabacie', () => {
      expect(stageValueForView(discounted, 5, TOTAL_QTY, 'client')).toBe(50) // 100 − (100 × 5/10)
    })
  })
})

describe('rabat dotyczy tylko widoku klienta — wykonawca liczy bez rabatu', () => {
  for (const discount of [
    { discountType: 'percent' as const, discountValue: 10 },
    { discountType: 'amount' as const, discountValue: 40 },
  ]) {
    it(`widok wykonawcy ignoruje rabat ${discount.discountType}, klient go stosuje`, () => {
      const row = { ...item, ...discount }
      expect(netForQtyForView(row, TOTAL_QTY, 'client')).toBeLessThan(TOTAL_QTY * item.clientPrice)
      for (const view of ['w_tools', 'own_tools'] as const) {
        expect(netForQtyForView(row, TOTAL_QTY, view)).toBe(
          netForQtyForView({ ...item, discountType: null, discountValue: 0 }, TOTAL_QTY, view),
        )
        expect(rowDiscountForView(row, TOTAL_QTY, view)).toBe(0)
      }
      expect(rowDiscountForView(row, TOTAL_QTY, 'client')).toBeGreaterThan(0)
    })
  }
})

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

describe('rowDoneFraction', () => {
  const planned20 = { ...item, plannedQty: 20 }

  it('ułamek liczy się z Przedmiaru, nie z sumy etapów', () => {
    expect(rowDoneFraction(planned20, 19)).toBe(0.95) // 19 / 20
    expect(rowDoneFraction(item, 7)).toBe(0.7) // 7 / 10
  })

  it('cena i rabat nie ruszają procentu', () => {
    for (const discounted of [
      { ...item, clientPrice: 999 },
      { ...item, discountType: 'percent' as const, discountValue: 10 },
      { ...item, discountType: 'amount' as const, discountValue: 40 },
    ]) {
      expect(rowDoneFraction(discounted, 7)).toBe(0.7)
    }
  })

  it('no planned qty → null (no denominator), never zero and never Infinity', () => {
    const noPlan = { ...item, plannedQty: 0 }
    expect(rowDoneFraction(noPlan, 3)).toBeNull()
  })

  // A `=== 0` guard falls
  // through and divides: 0/null → NaN → "NaN%", 3/null → Infinity → "∞%" in the always-visible cell.
  it('a cleared planned qty is a missing denominator too, not a divisor', () => {
    for (const empty of [null, undefined]) {
      const cleared = { ...item, plannedQty: empty as unknown as number }
      expect(rowDoneFraction(cleared, 3)).toBeNull()
      expect(rowDoneFraction(cleared, 0)).toBeNull()
    }
  })

  it('overshooting the planned qty passes through unclamped — it signals bad data', () => {
    expect(rowDoneFraction(item, 15)).toBe(1.5)
  })

  it('dzieli przez Aktualizację przedmiaru, gdy ją wpisano', () => {
    expect(rowDoneFraction({ ...item, currentPlannedQty: 15 }, 12)).toBeCloseTo(0.8, 10)
    expect(rowDoneFraction({ ...item, currentPlannedQty: null }, 12)).toBe(1.2)
  })

  it('aktualizacja 0 = poza zakresem, nie ma z czego liczyć procentu', () => {
    expect(rowDoneFraction({ ...item, currentPlannedQty: 0 }, 3)).toBeNull()
  })
})

describe('rowCurrentPlannedNetForView', () => {
  it('wycenia Aktualizację przedmiaru z tym samym rabatem co ofertę', () => {
    const updated = {
      ...item,
      currentPlannedQty: 15,
      discountType: 'amount' as const,
      discountValue: 40,
    }
    expect(rowPlannedNetForView(updated, 'client')).toBe(160) // 10 × 20 − 40
    expect(rowCurrentPlannedNetForView(updated, 'client')).toBe(260) // 15 × 20 − 40
  })

  it('bez ręcznej aktualizacji równa się wartości oferty', () => {
    expect(rowCurrentPlannedNetForView(item, 'client')).toBe(rowPlannedNetForView(item, 'client'))
  })

  it('aktualizacja 0 jest warta zero, nie minus rabat', () => {
    const dropped = {
      ...item,
      currentPlannedQty: 0,
      discountType: 'amount' as const,
      discountValue: 40,
    }
    expect(rowCurrentPlannedNetForView(dropped, 'client')).toBe(0)
  })
})

describe('rowPlannedNetForView', () => {
  const planned12 = { ...item, plannedQty: 12 }

  it('liczy z przedmiaru, nie z sumy etapów', () => {
    expect(rowPlannedNetForView(planned12, 'client')).toBe(240) // 12 × 20
    expect(netForQtyForView(planned12, TOTAL_QTY, 'client')).toBe(200) // 10 × 20 — suma etapów
  })

  it('wg ceny aktywnego widoku', () => {
    expect(rowPlannedNetForView(planned12, 'w_tools')).toBe(144) // 12 × 12
    expect(rowPlannedNetForView(planned12, 'own_tools')).toBe(120) // 12 × 10
  })

  it('rabat procentowy wchodzi w wartość przedmiaru', () => {
    const discounted = { ...planned12, discountType: 'percent' as const, discountValue: 10 }
    expect(rowPlannedNetForView(discounted, 'client')).toBe(216) // 240 − 10%
  })

  it('rabat kwotowy wchodzi w wartość przedmiaru', () => {
    const discounted = { ...planned12, discountType: 'amount' as const, discountValue: 30 }
    expect(rowPlannedNetForView(discounted, 'client')).toBe(210) // 240 − 30
  })
})

describe('rowPlannedNetPreDiscountForView', () => {
  const planned12 = { ...item, plannedQty: 12 }

  it('bez rabatu zgadza się z wartością przedmiaru w każdym widoku', () => {
    for (const view of ['client', 'w_tools', 'own_tools'] as PriceViewT[]) {
      expect(rowPlannedNetPreDiscountForView(planned12, view)).toBe(
        rowPlannedNetForView(planned12, view),
      )
    }
  })

  it('rabat procentowy nie schodzi z ceny inwestora', () => {
    const discounted = { ...planned12, discountType: 'percent' as const, discountValue: 10 }
    expect(rowPlannedNetPreDiscountForView(discounted, 'client')).toBe(240)
    expect(rowPlannedNetForView(discounted, 'client')).toBe(216)
  })

  it('rabat kwotowy nie schodzi z ceny inwestora', () => {
    const discounted = { ...planned12, discountType: 'amount' as const, discountValue: 30 }
    expect(rowPlannedNetPreDiscountForView(discounted, 'client')).toBe(240)
    expect(rowPlannedNetForView(discounted, 'client')).toBe(210)
  })

  it('na planach podwykonawcy rabat nie robi różnicy', () => {
    const discounted = { ...planned12, discountType: 'percent' as const, discountValue: 10 }
    expect(rowPlannedNetPreDiscountForView(discounted, 'w_tools')).toBe(144)
    expect(rowPlannedNetPreDiscountForView(discounted, 'own_tools')).toBe(120)
  })

  it('rabat globalny też nie schodzi', () => {
    const global = { ...planned12, globalDiscountActive: true }
    expect(rowPlannedNetPreDiscountForView(global, 'client')).toBe(240)
  })

  it('przedmiar 0 to 0, nie ujemna kwota rabatu', () => {
    const empty = { ...item, plannedQty: 0, discountType: 'amount' as const, discountValue: 30 }
    expect(rowPlannedNetPreDiscountForView(empty, 'client')).toBe(0)
  })
})

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

const gross = (row: ViewPricingT, view: PriceViewT, vatRate: number) =>
  netForQtyForView(row, TOTAL_QTY, view) * (1 + vatRate)

describe('brutto = netto × (1 + vatRate)', () => {
  it('plain row, 8%', () => {
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

describe('rabat globalny — nadpisuje rabat per pozycja', () => {
  it('aktywny globalny rabat → wiersz liczy się bez własnego rabatu (przedmiar i wykonanie)', () => {
    for (const perItem of [
      { discountType: 'percent' as const, discountValue: 10 },
      { discountType: 'amount' as const, discountValue: 50 },
    ]) {
      const row = { ...item, plannedQty: 12, ...perItem, globalDiscountActive: true }
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

describe('globalDiscountAmount / do zapłaty', () => {
  it('kwota jest płaska', () => {
    expect(globalDiscountAmount(1000, { type: 'amount', value: 250 })).toBe(250)
  })

  it('brak rabatu / zero → 0', () => {
    expect(globalDiscountAmount(1000, { type: null, value: 0 })).toBe(0)
    expect(globalDiscountAmount(1000, { type: 'amount', value: 0 })).toBe(0)
  })

  it('legacy procent → 0 (rabat globalny jest już tylko kwotowy)', () => {
    expect(globalDiscountAmount(1000, { type: 'percent' as never, value: 10 })).toBe(0)
  })

  it('do zapłaty = suma − rabat', () => {
    const totalNet = 1000
    expect(totalNet - globalDiscountAmount(totalNet, { type: 'amount', value: 250 })).toBe(750)
  })
})

describe('isGlobalDiscountActive', () => {
  it('aktywny dla trybu kwotowego przy każdej wartości', () => {
    expect(isGlobalDiscountActive({ type: 'amount', value: 250 })).toBe(true)
    // Zero kwota still replaces per-item rabat — otherwise typing 0 resurrects every rabat pozycji.
    expect(isGlobalDiscountActive({ type: 'amount', value: 0 })).toBe(true)
  })

  it('brak trybu → nieaktywny', () => {
    expect(isGlobalDiscountActive({ type: null, value: 0 })).toBe(false)
    expect(isGlobalDiscountActive({ type: null, value: 500 })).toBe(false)
  })

  it('legacy procent / uszkodzony tryb → fail closed (nieaktywny)', () => {
    // A persisted value that isn't 'amount' must NOT go active — otherwise per-item rabat is suppressed while
    // globalDiscountAmount subtracts nothing.
    expect(isGlobalDiscountActive({ type: 'percent' as never, value: 100 })).toBe(false)
    expect(isGlobalDiscountActive({ type: 'bogus' as never, value: 100 })).toBe(false)
  })
})

describe('globalDiscountForMode', () => {
  it('wejście w „Kwotowy" aktywuje rabat globalny, nie czeka na kwotę', () => {
    expect(globalDiscountForMode('amount', 340)).toEqual({ type: 'amount', value: 340 })
  })

  it('kwota startowa = suma rabatów per pozycja, więc przełączenie nie rusza żadnej liczby', () => {
    expect(globalDiscountForMode('amount', 0).value).toBe(0)
    expect(globalDiscountForMode('amount', 1234.56).value).toBe(1234.56)
  })

  it('„Wyłączony" i „%" czyszczą rabat globalny — obie są drogą powrotną do rabatów per pozycja', () => {
    expect(globalDiscountForMode('off', 340)).toEqual({ type: null, value: 0 })
    expect(globalDiscountForMode('percent', 340)).toEqual({ type: null, value: 0 })
  })
})
