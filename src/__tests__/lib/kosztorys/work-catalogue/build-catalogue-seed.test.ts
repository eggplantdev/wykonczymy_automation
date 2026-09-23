import { describe, expect, it } from 'vitest'
import type { SnapshotPayloadT, SnapshotSettingsT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { buildCatalogueSeed } from '@/lib/kosztorys/work-catalogue/build-catalogue-seed'

const SETTINGS: SnapshotSettingsT = { wToolsCoeff: 0.6, ownToolsCoeff: 0.5, vatRate: 0.23 }

const section = (id: number, name: string): KosztorysSectionT => ({
  id,
  name,
  displayOrder: id,
  color: null,
})

let nextItemId = 0

const item = (
  sectionId: number,
  description: string,
  clientPrice: number,
  overrides: Partial<KosztorysItemT> = {},
): KosztorysItemT => ({
  id: (nextItemId += 1),
  sectionId,
  displayOrder: nextItemId,
  description,
  unit: 'm2',
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
  ...overrides,
})

const payloadOf = (sections: KosztorysSectionT[], items: KosztorysItemT[]): SnapshotPayloadT => ({
  schemaVersion: 1,
  sections,
  items,
  stages: [],
  progress: [],
  settings: SETTINGS,
})

const seedOf = (sections: KosztorysSectionT[], items: KosztorysItemT[]) =>
  buildCatalogueSeed(payloadOf(sections, items))

describe('buildCatalogueSeed', () => {
  it('zwija powtórzenia tego samego opisu i j.m. do jednej pozycji', () => {
    const { items } = seedOf(
      [section(1, 'Łazienka 1'), section(2, 'Łazienka 2')],
      [item(1, 'Gruntowanie ścian', 20), item(2, 'gruntowanie SCIAN', 20)],
    )

    expect(items).toHaveLength(1)
    expect(items[0].matchKey).toBe(catalogueKey('Gruntowanie ścian', 'm2'))
  })

  it('rozdziela ten sam opis o różnych j.m.', () => {
    const { items } = seedOf(
      [section(1, 'Łazienka 1')],
      [item(1, 'Listwa', 10), item(1, 'Listwa', 10, { unit: 'mb' })],
    )

    expect(items).toHaveLength(2)
  })

  it('wybiera wartość najczęstszą, nie najwyższą', () => {
    const { items } = seedOf(
      [
        section(1, 'WC'),
        section(2, 'Łazienka 1'),
        section(3, 'Łazienka 2'),
        section(4, 'Łazienka 3'),
      ],
      [
        item(1, 'Ułożenie płytek', 250),
        item(2, 'Ułożenie płytek', 300),
        item(3, 'Ułożenie płytek', 250),
        item(4, 'Ułożenie płytek', 250),
      ],
    )

    expect(items[0].clientPrice).toBe(250)
  })

  it('przy remisie wybiera wyższą', () => {
    const { items } = seedOf(
      [section(1, 'WC'), section(2, 'Łazienka 1')],
      [
        item(1, 'Ułożenie płytek', 250),
        item(1, 'Ułożenie płytek', 300),
        item(2, 'Ułożenie płytek', 250),
        item(2, 'Ułożenie płytek', 300),
      ],
    )

    expect(items[0].clientPrice).toBe(300)
  })

  it('raportuje rozbieżność, ale i tak wystawia pozycję', () => {
    const { items, conflicts } = seedOf(
      [section(1, 'WC'), section(2, 'Łazienka 1')],
      [item(1, 'Ułożenie płytek', 250), item(2, 'Ułożenie płytek', 300)],
    )

    expect(items).toHaveLength(1)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].fields).toEqual(['clientPrice'])
    expect(conflicts[0].occurrences.map((o) => o.clientPrice)).toEqual([250, 300])
  })

  it('raportuje rozjazd samej stawki przy zgodnej cenie', () => {
    const { conflicts } = seedOf(
      [section(1, 'WC'), section(2, 'Łazienka 1')],
      [
        item(1, 'Ułożenie płytek', 200),
        item(2, 'Ułożenie płytek', 200, {
          wToolsOverrideValue: 90,
        }),
      ],
    )

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].fields).toEqual(['wToolsRate'])
  })

  it('nie raportuje rozbieżności, gdy wszystkie wystąpienia się zgadzają', () => {
    const { conflicts } = seedOf(
      [section(1, 'WC'), section(2, 'Łazienka 1')],
      [item(1, 'Ułożenie płytek', 250), item(2, 'Ułożenie płytek', 250)],
    )

    expect(conflicts).toEqual([])
  })

  it('ucina końcowy numer z nazwy sekcji, zostawiając liczbę wewnątrz nazwy', () => {
    const { items } = seedOf(
      [section(1, 'Łazienka 1'), section(2, 'Gniazdka 230V')],
      [item(1, 'Fugowanie', 30), item(2, 'Gniazdko', 40)],
    )

    expect(items.map((entry) => entry.category)).toEqual(['Łazienka', 'Gniazdka 230V'])
  })

  it('bierze kategorię z wystąpienia, które wygrało cenę', () => {
    const { items } = seedOf(
      [section(1, 'Łazienka 1'), section(2, 'Kuchnia 2'), section(3, 'Kuchnia 3')],
      [
        item(1, 'Ułożenie płytek', 300),
        item(2, 'Ułożenie płytek', 250),
        item(3, 'Ułożenie płytek', 250),
      ],
    )

    expect(items[0].category).toBe('Kuchnia')
  })

  it('praca bez nadpisania trafia do cennika jako „auto", nie jako kwota', () => {
    const { items } = seedOf([section(1, 'WC')], [item(1, 'Ułożenie płytek', 200)])

    expect(items[0].wToolsRate).toBeNull()
    expect(items[0].ownToolsRate).toBeNull()
  })

  it('„auto" przeciw kwocie to rozbieżność, a wygrywa strona liczniejsza', () => {
    const { items, conflicts } = seedOf(
      [section(1, 'WC'), section(2, 'Łazienka 1'), section(3, 'Łazienka 2')],
      [
        item(1, 'Ułożenie płytek', 200),
        item(2, 'Ułożenie płytek', 200, {
          wToolsOverrideValue: 90,
        }),
        item(3, 'Ułożenie płytek', 200, {
          wToolsOverrideValue: 90,
        }),
      ],
    )

    expect(conflicts[0].fields).toEqual(['wToolsRate'])
    expect(items[0].wToolsRate).toBe(90)
  })

  it('przy remisie „auto" z kwotą wygrywa kwota', () => {
    const { items } = seedOf(
      [section(1, 'WC'), section(2, 'Łazienka 1')],
      [
        item(1, 'Ułożenie płytek', 200),
        item(2, 'Ułożenie płytek', 200, {
          wToolsOverrideValue: 90,
        }),
      ],
    )

    expect(items[0].wToolsRate).toBe(90)
  })

  it('praca z nadpisaniem kwotowym zamraża swoją stawkę', () => {
    const { items } = seedOf(
      [section(1, 'WC')],
      [
        item(1, 'Ułożenie płytek', 200, {
          wToolsOverrideValue: 90,
        }),
      ],
    )

    expect(items[0].wToolsRate).toBe(90)
    expect(items[0].ownToolsRate).toBeNull()
  })

  it('pomija pracę bez opisu', () => {
    const { items } = seedOf(
      [section(1, 'WC')],
      [item(1, '   ', 10), item(1, null as unknown as string, 10)],
    )

    expect(items).toEqual([])
  })
})
