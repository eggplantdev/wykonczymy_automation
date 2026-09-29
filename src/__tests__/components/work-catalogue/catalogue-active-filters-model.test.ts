import { describe, expect, it } from 'vitest'
import { catalogueActiveFiltersModel } from '@/components/work-catalogue/catalogue-active-filters-model'
import { FILTER_NONE } from '@/components/filters/filter-multi-select'
import { CATALOGUE_CONDITIONS } from '@/lib/kosztorys/work-catalogue/catalogue-conditions'

const empty = { values: [], options: [] }

describe('catalogueActiveFiltersModel', () => {
  it('has no chips when nothing narrows the table', () => {
    expect(
      catalogueActiveFiltersModel({
        conditions: CATALOGUE_CONDITIONS,
        engagedIds: new Set(),
        counts: new Map(),
        search: '  ',
        categories: empty,
        units: empty,
      }),
    ).toEqual([])
  })

  it('names every source, with the direction each one pulls', () => {
    const chips = catalogueActiveFiltersModel({
      conditions: CATALOGUE_CONDITIONS,
      engagedIds: new Set(['catalogue-source-auto-w_tools', 'catalogue-no-price', 'unknown']),
      counts: new Map([['catalogue-no-price', 20]]),
      search: 'tynk',
      categories: { values: ['', 'Malarskie'], options: [{ value: '', label: 'Bez kategorii' }] },
      units: { values: [FILTER_NONE], options: [] },
    })
    expect(chips.map((chip) => [chip.removal, chip.label])).toEqual([
      ['problem', 'Tylko: prace bez ceny j.m.'],
      ['condition', 'Ukryto: prace auto — z narzędziami (podwykonawca)'],
      ['search', 'Szukaj: „tynk"'],
      ['category', 'Kategoria: Bez kategorii, Malarskie'],
      ['unit', 'j.m.: żadna'],
    ])
    expect(chips[0]?.count).toBe(20)
  })
})
