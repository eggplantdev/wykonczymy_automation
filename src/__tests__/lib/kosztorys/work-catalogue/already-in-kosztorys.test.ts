import { describe, expect, it } from 'vitest'
import {
  kosztorysCatalogueKeys,
  partitionAlreadyInKosztorys,
} from '@/lib/kosztorys/work-catalogue/already-in-kosztorys'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

let nextId = 1

// `matchKey` is written out rather than derived with `catalogueKey`: folding both sides with the
// subject's own function would make every assertion move with the folding rule instead of pinning it.
const entry = (description: string, unit: string, matchKey: string): WorkCatalogueItemT => ({
  id: nextId++,
  description,
  category: null,
  unit,
  clientPrice: 100,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey,
})

const split = (
  catalogue: readonly WorkCatalogueItemT[],
  items: readonly { description: string | null; unit: string | null }[],
) => partitionAlreadyInKosztorys(catalogue, kosztorysCatalogueKeys(items))

describe('kosztorysCatalogueKeys', () => {
  it('składa klucz z opisu i j.m., a brak j.m. zapisuje sentinelem', () => {
    expect([
      ...kosztorysCatalogueKeys([{ description: '  MALOWANIE   ŚCIAN ', unit: 'm2' }]),
    ]).toEqual(['malowanie scian|m2'])
    expect([...kosztorysCatalogueKeys([{ description: 'Gruntowanie', unit: null }])]).toEqual([
      'gruntowanie|~',
    ])
  })

  it('pomija pozycję bez nazwy — katalog takiej nie ma, więc trafiłaby tylko przypadkiem', () => {
    expect(kosztorysCatalogueKeys([{ description: null, unit: 'm2' }]).size).toBe(0)
    expect(kosztorysCatalogueKeys([{ description: '   ', unit: 'm2' }]).size).toBe(0)
  })
})

describe('partitionAlreadyInKosztorys', () => {
  it('odkłada pracę, którą kosztorys już ma — niezależnie od sekcji', () => {
    const result = split(
      [
        entry('Malowanie ścian', 'm2', 'malowanie scian|m2'),
        entry('Gruntowanie', 'm2', 'gruntowanie|m2'),
      ],
      [{ description: 'Malowanie ścian', unit: 'm2' }],
    )

    expect(result.fresh.map((item) => item.description)).toEqual(['Gruntowanie'])
    expect(result.alreadyAdded.map((item) => item.description)).toEqual(['Malowanie ścian'])
  })

  it('dopasowuje mimo różnic w zapisie opisu', () => {
    const result = split(
      [entry('Malowanie ścian', 'm2', 'malowanie scian|m2')],
      [{ description: '  MALOWANIE   ŚCIAN ', unit: 'm2' }],
    )

    expect(result.fresh).toEqual([])
    expect(result.alreadyAdded).toHaveLength(1)
  })

  it('ten sam opis przy innej j.m. to inna praca, więc zostaje na liście', () => {
    const result = split(
      [entry('Montaż gniazdka', 'szt', 'montaz gniazdka|szt')],
      [{ description: 'Montaż gniazdka', unit: 'm2' }],
    )

    expect(result.fresh).toHaveLength(1)
    expect(result.alreadyAdded).toEqual([])
  })

  it('pozycja bez j.m. nie zasłania wpisu z katalogu, który j.m. ma', () => {
    const result = split(
      [entry('Gruntowanie', 'm2', 'gruntowanie|m2')],
      [{ description: 'Gruntowanie', unit: null }],
    )

    expect(result.fresh).toHaveLength(1)
    expect(result.alreadyAdded).toEqual([])
  })

  it('pusta rozpiska nie odkłada niczego', () => {
    const result = split([entry('Gruntowanie', 'm2', 'gruntowanie|m2')], [])

    expect(result.fresh).toHaveLength(1)
    expect(result.alreadyAdded).toEqual([])
  })
})
