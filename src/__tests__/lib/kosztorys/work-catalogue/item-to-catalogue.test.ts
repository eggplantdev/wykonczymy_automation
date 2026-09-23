import { describe, expect, it } from 'vitest'
import type { CatalogueSourceItemT } from '@/lib/kosztorys/work-catalogue/types'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'

const source = (overrides: Partial<CatalogueSourceItemT> = {}): CatalogueSourceItemT => ({
  description: 'Ułożenie płytek',
  unit: 'm2',
  sectionName: 'Łazienka 1',
  clientPrice: 200,
  wToolsOverrideValue: null,
  wToolsOverrideCoeff: null,
  ownToolsOverrideValue: null,
  ownToolsOverrideCoeff: null,
  ...overrides,
})

describe('toCatalogueCandidate', () => {
  it('zamraża kwotę, gdy pozycja ma własne nadpisanie kwotowe', () => {
    const candidate = toCatalogueCandidate(source({ wToolsOverrideValue: 90 }))

    expect(candidate.wToolsRate).toBe(90)
  })

  it('bez nadpisania stawka trafia do cennika jako „auto"', () => {
    const candidate = toCatalogueCandidate(source())

    expect(candidate.wToolsRate).toBeNull()
    expect(candidate.ownToolsRate).toBeNull()
  })

  it('mnożnik z rozpiski trafia do cennika jako mnożnik, nie jako wyliczona kwota', () => {
    const candidate = toCatalogueCandidate(source({ wToolsOverrideCoeff: 0.65 }))

    expect(candidate.wToolsRate).toBeNull()
    expect(candidate.wToolsRateCoeff).toBe(0.65)
  })

  it('decyduje o każdym planie osobno', () => {
    const candidate = toCatalogueCandidate(source({ ownToolsOverrideValue: 80 }))

    expect(candidate.wToolsRate).toBeNull()
    expect(candidate.ownToolsRate).toBe(80)
  })

  it('bierze cenę sprzed rabatu i kategorię z nazwy sekcji bez numeru', () => {
    const candidate = toCatalogueCandidate(source({ clientPrice: 250 }))

    expect(candidate.clientPrice).toBe(250)
    expect(candidate.category).toBe('Łazienka')
  })
})
