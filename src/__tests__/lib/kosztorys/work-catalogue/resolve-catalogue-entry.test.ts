import { describe, expect, it, vi } from 'vitest'
import {
  indexCatalogue,
  resolveCatalogueEntry,
} from '@/lib/kosztorys/work-catalogue/resolve-catalogue-entry'

const GLADZ = { id: 1, matchKey: 'gladz polimerowa|m2' }
const GIPS = { id: 2, matchKey: 'gladz gipsowa|m2' }
const index = indexCatalogue([GLADZ, GIPS])

describe('resolveCatalogueEntry', () => {
  it('zapamiętana praca wygrywa z wpisem o tym samym opisie co pozycja', () => {
    expect(resolveCatalogueEntry(index, GLADZ.id, () => GIPS.matchKey)).toBe(GLADZ)
  })

  it('pozycja znaleziona po pracy nie składa klucza', () => {
    const matchKey = vi.fn(() => GIPS.matchKey)
    resolveCatalogueEntry(index, GLADZ.id, matchKey)
    expect(matchKey).not.toHaveBeenCalled()
  })

  it('usunięta praca oddaje pozycję kluczowi', () => {
    expect(resolveCatalogueEntry(index, 999, () => GIPS.matchKey)).toBe(GIPS)
  })

  it('pozycja bez zapamiętanej pracy idzie po kluczu, a bez trafienia nie ma pracy', () => {
    expect(resolveCatalogueEntry(index, null, () => GIPS.matchKey)).toBe(GIPS)
    expect(resolveCatalogueEntry(index, undefined, () => 'arbuz|m2')).toBeUndefined()
  })
})
