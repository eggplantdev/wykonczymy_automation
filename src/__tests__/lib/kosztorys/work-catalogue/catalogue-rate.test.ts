import { describe, expect, it } from 'vitest'
import {
  catalogueRateFor,
  catalogueRateValue,
  catalogueSourceOf,
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
