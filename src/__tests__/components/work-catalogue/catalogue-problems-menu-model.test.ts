import { describe, expect, it } from 'vitest'
import { catalogueProblemsMenuModel } from '@/components/work-catalogue/catalogue-problems-menu-model'

describe('catalogueProblemsMenuModel', () => {
  it('is empty when nothing is wrong, which hides the menu', () => {
    expect(catalogueProblemsMenuModel({ engagedIds: new Set(), counts: new Map() })).toEqual([])
  })

  it('lists problems with matches; the engaged one is ticked and survives at (0)', () => {
    const toggles = catalogueProblemsMenuModel({
      engagedIds: new Set(['catalogue-zero-rate-own_tools']),
      counts: new Map([['catalogue-no-price', 20]]),
    })
    expect(toggles).toEqual([
      {
        id: 'catalogue-no-price',
        groupLabel: 'Cena',
        label: 'Prace bez ceny j.m. (20)',
        active: false,
      },
      expect.objectContaining({ id: 'catalogue-zero-rate-own_tools', active: true }),
    ])
  })
})
