import { describe, expect, it } from 'vitest'
import { findNearDuplicates } from '@/lib/kosztorys/work-catalogue/catalogue-near-duplicates'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

let nextId = 1
const entry = (
  description: string,
  fields: Partial<WorkCatalogueItemT> = {},
): WorkCatalogueItemT => ({
  id: nextId++,
  description,
  category: null,
  unit: 'szt',
  clientPrice: 100,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: description,
  ...fields,
})

const twinsOf = (catalogue: WorkCatalogueItemT[], of: WorkCatalogueItemT) =>
  (findNearDuplicates(catalogue).get(of.id) ?? []).map((twin) => ({
    description: twin.entry.description,
    kind: twin.kind,
  }))

describe('findNearDuplicates', () => {
  it('pairs a different word ending across j.m., kategoria and cena, both ways', () => {
    const singular = entry('Montaż syfonu', { category: 'Kuchnia', clientPrice: 80 })
    const plural = entry('Montaż syfonów', { category: 'Łazienka', unit: 'kpl', clientPrice: 95 })
    const catalogue = [singular, plural]

    expect(twinsOf(catalogue, singular)).toEqual([{ description: 'Montaż syfonów', kind: 'same' }])
    expect(twinsOf(catalogue, plural)).toEqual([{ description: 'Montaż syfonu', kind: 'same' }])
  })

  it('ignores a j.m. written into the opis, including a superscript one', () => {
    const perMetre = entry('Skucie posadzki mb', { unit: 'mb' })
    const perSquare = entry('Skucie posadzki m²', { unit: 'm²' })

    expect(twinsOf([perMetre, perSquare], perMetre)).toEqual([
      { description: 'Skucie posadzki m²', kind: 'same' },
    ])
  })

  it('pairs one word more or less as the weaker kind', () => {
    const plain = entry('Montaż parapetów')
    const stone = entry('Montaż parapetów kamiennych')

    expect(twinsOf([plain, stone], plain)).toEqual([
      { description: 'Montaż parapetów kamiennych', kind: 'oneWord' },
    ])
  })

  it('never pairs a variant that differs in a number', () => {
    const catalogue = [
      entry('Przebudowa rozdzielni wraz z bezpiecznikami - do 12 modułów'),
      entry('Przebudowa rozdzielni wraz z bezpiecznikami - do 18 modułów'),
      entry('Murowanie ścian z bloczków komórkowych 7,5 cm'),
      entry('Murowanie ścian z bloczków komórkowych 5 cm'),
      entry('Gładzie na ścianach - standard wykończenia Q3'),
      entry('Gładzie na ścianach - standard wykończenia Q4'),
    ]

    expect(findNearDuplicates(catalogue).size).toBe(0)
  })

  it('never pairs two opisy that differ in a word on each side, or in two words', () => {
    const catalogue = [
      entry('Układanie glazury na podłodze'),
      entry('Układanie gresu na balkonie'),
      entry('Montaż lustra'),
      entry('Montaż lustra z oświetleniem LED'),
    ]

    expect(findNearDuplicates(catalogue).size).toBe(0)
  })

  it('does not read a shared first syllable as the same word', () => {
    const catalogue = [
      entry('Szlifowanie podłodze'),
      entry('Szlifowanie podłączenia'),
      entry('Montaż przedłużek'),
      entry('Montaż przedpokoju'),
    ]

    expect(findNearDuplicates(catalogue).size).toBe(0)
  })

  it('needs two content words, so a bare verb is not a twin of every praca it starts', () => {
    expect(findNearDuplicates([entry('Montaż'), entry('Montaż grzejnika')]).size).toBe(0)
  })

  it('lists the stronger twins first', () => {
    const subject = entry('Montaż kratki wentylacyjnej')
    const catalogue = [
      subject,
      entry('Montaż i demontaż kratki wentylacyjnej'),
      entry('Montaż kratek wentylacyjnych'),
    ]

    expect(twinsOf(catalogue, subject).map((twin) => twin.kind)).toEqual(['same', 'oneWord'])
  })
})
