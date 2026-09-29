import { describe, expect, it } from 'vitest'
import { buildCatalogueUsage } from '@/lib/kosztorys/work-catalogue/catalogue-usage'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const entry = (id: number, description: string, unit: string): WorkCatalogueItemT => ({
  id,
  description,
  category: null,
  unit,
  clientPrice: 100,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: catalogueKey(description, unit),
})

const used = (investmentId: number, description: string, unit: string | null = 'm2') => ({
  investmentId,
  description,
  unit,
})

const PAINT = entry(1, 'Malowanie ścian na biało', 'm2')
const TILE = entry(2, 'Układanie płytek ściennych', 'm2')
const DOOR = entry(3, 'Montaż drzwi wewnętrznych', 'szt')

describe('buildCatalogueUsage', () => {
  it('counts distinct inwestycje, not pozycje', () => {
    const usage = buildCatalogueUsage(
      [used(10, PAINT.description), used(10, PAINT.description), used(11, PAINT.description)],
      [PAINT, TILE],
    )
    expect(usage.byId).toEqual({ [PAINT.id]: 2 })
  })

  it('matches after the typo folding the catalogue key applies', () => {
    const usage = buildCatalogueUsage([used(10, 'Malowanie ścian na bało')], [PAINT])
    expect(usage.byId).toEqual({ [PAINT.id]: 1 })
    expect(usage.uncatalogued).toEqual([])
  })

  it('flags a praca whose opis is used under another j.m.', () => {
    const usage = buildCatalogueUsage([used(10, TILE.description, 'mb')], [PAINT, TILE])
    expect(usage.otherUnitIds).toEqual([TILE.id])
    expect(usage.byId).toEqual({})
  })

  it('groups uncatalogued keys by kosztorys count, then opis, with the commonest spelling', () => {
    const usage = buildCatalogueUsage(
      [
        used(10, 'Zabudowa GK'),
        used(10, 'Szpachlowanie sufitu'),
        used(11, 'Szpachlowanie  sufitu'),
        used(12, 'Szpachlowanie sufitu'),
        used(13, 'Arbuz'),
      ],
      [PAINT],
    )
    expect(
      usage.uncatalogued.map(({ description, kosztorysCount }) => [description, kosztorysCount]),
    ).toEqual([
      ['Szpachlowanie sufitu', 3],
      ['Arbuz', 1],
      ['Zabudowa GK', 1],
    ])
  })

  it('offers a close cennik opis as a hint and never counts it', () => {
    const usage = buildCatalogueUsage(
      [used(10, 'Montaż drzwi wewnętrznych przesuwnych', 'szt'), used(11, 'Arbuz')],
      [PAINT, DOOR],
    )
    const [door, unrelated] = [
      usage.uncatalogued.find((row) => row.description.startsWith('Montaż')),
      usage.uncatalogued.find((row) => row.description === 'Arbuz'),
    ]
    expect(door?.hints.map((hint) => hint.id)).toEqual([DOOR.id])
    expect(unrelated?.hints).toEqual([])
    expect(usage.byId).toEqual({})
  })
})
