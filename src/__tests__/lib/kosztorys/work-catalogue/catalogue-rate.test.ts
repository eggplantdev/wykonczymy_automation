import { describe, expect, it } from 'vitest'
import {
  catalogueRateAmount,
  catalogueRateFor,
  catalogueRateValue,
  catalogueSourceOf,
  isCatalogueOverCeiling,
  type CatalogueRateT,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'

// Jedno miejsce, w którym cennik rozstrzyga „skąd bierze się ta stawka" — te same trzy źródła i to
// samo pierwszeństwo co w rozpisce. Reszta katalogu (tabela, porównanie, przeniesienie do rozpiski)
// czyta wyłącznie stąd, więc pomyłka tutaj jest pomyłką wszędzie naraz.
describe('catalogueSourceOf', () => {
  it('mnożnik bije kwotę — para nigdy nie powinna istnieć, ale czytelnik musi być rozstrzygalny', () => {
    expect(catalogueSourceOf({ rate: 65, coeff: 0.65 })).toBe('coeff')
  })

  it('sama kwota to kwota stała, brak obu to auto', () => {
    expect(catalogueSourceOf({ rate: 65, coeff: null })).toBe('amount')
    expect(catalogueSourceOf({ rate: null, coeff: null })).toBe('auto')
  })

  // Zero to decyzja, a nie brak: praca, za którą wykonawca nie dostaje nic, ma stawkę 0 zł.
  it('zero jest odpowiedzią, nie pustką — na obu kolumnach', () => {
    expect(catalogueSourceOf({ rate: 0, coeff: null })).toBe('amount')
    expect(catalogueSourceOf({ rate: null, coeff: 0 })).toBe('coeff')
  })

  // 2026-09-23: katalog podawany z wpisu cache'a zapisanego, zanim kolumny mnożnika istniały, nie
  // miał tych kluczy wcale. `!== null` przepuszczało `undefined` jako „ktoś tu ustawił mnożnik", więc
  // wiersze z kwotą stałą wyświetlały „×0". Nieznana wartość należy na DNO pierwszeństwa: „auto"
  // niczego nie twierdzi. Typ tego nie obroni — wartość przeszła przez granicę, która typy kasuje.
  it('kształt bez kolumn spada na „auto", zamiast udawać mnożnik', () => {
    const missing = {} as CatalogueRateT
    expect(catalogueSourceOf(missing)).toBe('auto')
  })

  // Ta sama reguła, drugie wcielenie śmiecia: test jest pozytywny („czy to liczba"), więc lista
  // odrzuceń nie musi być kompletna.
  it('NaN nie jest stawką', () => {
    expect(catalogueSourceOf({ rate: NaN, coeff: NaN })).toBe('auto')
    expect(catalogueSourceOf({ rate: 65, coeff: NaN })).toBe('amount')
  })
})

describe('catalogueRateValue', () => {
  it('mnożnik przelicza się od ceny j.m., więc podniesienie ceny rusza stawkę', () => {
    expect(catalogueRateValue({ rate: null, coeff: 0.65 }, 200, 0.5)).toBe(130)
  })

  it('kwota stała zostaje kwotą, cokolwiek mówi cena j.m. i współczynnik', () => {
    expect(catalogueRateValue({ rate: 65, coeff: null }, 200, 0.5)).toBe(65)
  })

  it('„auto" dopiero tutaj sięga po współczynnik inwestycji', () => {
    expect(catalogueRateValue({ rate: null, coeff: null }, 200, 0.5)).toBe(100)
  })

  // Kwota licząca się z nie-liczby dałaby NaN złotych, co dalej zabarwia sufit i sortowanie.
  it('śmieć w kolumnie wycenia się jak „auto", nie jak NaN', () => {
    expect(catalogueRateValue({} as CatalogueRateT, 200, 0.5)).toBe(100)
    expect(catalogueRateValue({ rate: NaN, coeff: NaN }, 200, 0.5)).toBe(100)
  })
})

describe('catalogueRateFor', () => {
  it('czyta parę kolumn tej płaszczyzny, której dotyczy pytanie', () => {
    const entry = {
      wToolsRate: null,
      wToolsRateCoeff: 0.65,
      ownToolsRate: 40,
      ownToolsRateCoeff: null,
    }
    expect(catalogueRateFor(entry, 'w_tools')).toEqual({ rate: null, coeff: 0.65 })
    expect(catalogueRateFor(entry, 'own_tools')).toEqual({ rate: 40, coeff: null })
  })
})

const entryAt = (
  clientPrice: number,
  wTools: CatalogueRateT,
  ownTools: CatalogueRateT = { rate: null, coeff: null },
) => ({
  clientPrice,
  wToolsRate: wTools.rate,
  wToolsRateCoeff: wTools.coeff,
  ownToolsRate: ownTools.rate,
  ownToolsRateCoeff: ownTools.coeff,
})

describe('catalogueRateAmount', () => {
  it('kwota stała jest sobą, mnożnik liczy się od ceny j.m. katalogu', () => {
    expect(catalogueRateAmount(entryAt(200, { rate: 65, coeff: null }), 'w_tools')).toBe(65)
    expect(catalogueRateAmount(entryAt(200, { rate: null, coeff: 0.5 }), 'w_tools')).toBe(100)
  })

  // „Auto" nie ma złotówki w katalogu — należy do inwestycji, więc nie ma czego mierzyć.
  it('„auto" nie ma kwoty', () => {
    expect(catalogueRateAmount(entryAt(200, { rate: null, coeff: null }), 'w_tools')).toBeNull()
  })

  it('czyta płaszczyznę, o którą pytano', () => {
    const entry = entryAt(100, { rate: 10, coeff: null }, { rate: 20, coeff: null })
    expect(catalogueRateAmount(entry, 'own_tools')).toBe(20)
  })
})

// Czerwona komórka udziału i filtry „ponad" / „w granicy" pytają tutaj — jedna odpowiedź dla obu.
describe('isCatalogueOverCeiling', () => {
  it('kwota ponad sufit płaszczyzny jest ponad, w granicy nie jest', () => {
    expect(isCatalogueOverCeiling(entryAt(100, { rate: 66, coeff: null }), 'w_tools')).toBe(true)
    expect(isCatalogueOverCeiling(entryAt(100, { rate: 65, coeff: null }), 'w_tools')).toBe(false)
  })

  // Bez narzędzi sufit jest niższy (55,25 %) — 60 zł mieści się w 65 %, a tu już nie.
  it('sufit jest per płaszczyzna', () => {
    const entry = entryAt(100, { rate: 60, coeff: null }, { rate: 60, coeff: null })
    expect(isCatalogueOverCeiling(entry, 'w_tools')).toBe(false)
    expect(isCatalogueOverCeiling(entry, 'own_tools')).toBe(true)
  })

  it('mnożnik ponad sufit jest ponad', () => {
    expect(isCatalogueOverCeiling(entryAt(100, { rate: null, coeff: 0.7 }), 'w_tools')).toBe(true)
  })

  it('„auto" nigdy nie jest ponad', () => {
    expect(isCatalogueOverCeiling(entryAt(100, { rate: null, coeff: null }), 'w_tools')).toBe(false)
  })

  it('bez ceny j.m. nie ma czego mierzyć', () => {
    expect(isCatalogueOverCeiling(entryAt(0, { rate: 50, coeff: null }), 'w_tools')).toBe(false)
  })
})
