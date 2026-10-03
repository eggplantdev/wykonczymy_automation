import { describe, expect, it } from 'vitest'
import {
  catalogueCategoryOptions,
  catalogueUnitOptions,
} from '@/lib/kosztorys/work-catalogue/category-options'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const item = (category: string | null): WorkCatalogueItemT => ({
  id: 1,
  description: 'Malowanie',
  descriptionTranslations: {},
  category,
  unit: 'm2',
  clientPrice: 100,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: 'malowanie|m2',
})

describe('catalogueCategoryOptions', () => {
  it('gives a praca with no kategoria its own option', () => {
    expect(catalogueCategoryOptions([item(null), item('Malarskie')])).toEqual([
      { value: '', label: 'Bez kategorii' },
      { value: 'Malarskie', label: 'Malarskie' },
    ])
  })

  it('treats an empty kategoria as the same option as none', () => {
    const options = catalogueCategoryOptions([item(''), item(null)])
    expect(options).toEqual([{ value: '', label: 'Bez kategorii' }])
  })

  it('sorts by Polish collation, so Ł lands before M and not after Z', () => {
    const options = catalogueCategoryOptions([
      item('Zbrojenie'),
      item('Malarskie'),
      item('Łazienka'),
    ])
    expect(options.map((option) => option.value)).toEqual(['Łazienka', 'Malarskie', 'Zbrojenie'])
  })
})

describe('catalogueUnitOptions', () => {
  it('gives a praca with no j.m. its own option and sorts the rest', () => {
    const units = ['m2', '', 'szt', 'm2'].map((unit) => ({ ...item(null), unit }))
    expect(catalogueUnitOptions(units)).toEqual([
      { value: '', label: 'bez j.m.' },
      { value: 'm2', label: 'm2' },
      { value: 'szt', label: 'szt' },
    ])
  })
})
