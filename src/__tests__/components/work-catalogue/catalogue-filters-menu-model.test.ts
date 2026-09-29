import { describe, expect, it } from 'vitest'
import { catalogueFiltersMenuModel } from '@/components/work-catalogue/catalogue-filters-menu-model'
import { CATALOGUE_CONDITIONS } from '@/lib/kosztorys/work-catalogue/catalogue-conditions'

const AMOUNT = 'catalogue-source-amount-w_tools'
const COEFF = 'catalogue-source-coeff-w_tools'

describe('catalogueFiltersMenuModel', () => {
  it('offers only filters with something to match, labelled with the count', () => {
    const toggles = catalogueFiltersMenuModel({
      conditions: CATALOGUE_CONDITIONS,
      engagedIds: new Set(),
      counts: new Map([
        [AMOUNT, 3],
        [COEFF, 0],
        ['catalogue-no-price', 5],
      ]),
    })
    expect(toggles).toEqual([
      {
        id: AMOUNT,
        groupLabel: 'Źródło stawki',
        label: 'Kwota stała — z narzędziami (podwykonawca) (3)',
        active: true,
      },
    ])
  })

  it('keeps an engaged filter at (0) and reads it as unticked', () => {
    const toggles = catalogueFiltersMenuModel({
      conditions: CATALOGUE_CONDITIONS,
      engagedIds: new Set([COEFF]),
      counts: new Map([[COEFF, 0]]),
    })
    expect(toggles).toEqual([expect.objectContaining({ id: COEFF, active: false })])
    expect(toggles[0]?.label).toMatch(/\(0\)$/)
  })
})
