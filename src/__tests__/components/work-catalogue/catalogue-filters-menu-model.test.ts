import { describe, expect, it } from 'vitest'
import { catalogueFiltersMenuModel } from '@/components/work-catalogue/catalogue-filters-menu-model'
import { CATALOGUE_CONDITIONS } from '@/lib/kosztorys/work-catalogue/catalogue-conditions'

const AMOUNT = 'catalogue-source-amount-w_tools'
const COEFF = 'catalogue-source-coeff-w_tools'
const ROW_COUNT = 10

const model = (counts: Record<string, number>, engaged: string[] = []) =>
  catalogueFiltersMenuModel({
    conditions: CATALOGUE_CONDITIONS,
    engagedIds: new Set(engaged),
    counts: new Map(Object.entries(counts)),
    rowCount: ROW_COUNT,
  })

describe('catalogueFiltersMenuModel', () => {
  it('offers only filters a tick would narrow, unticked, under a plane heading', () => {
    expect(model({ [AMOUNT]: 3, [COEFF]: 0, 'catalogue-no-price': 5 })).toEqual([
      {
        id: AMOUNT,
        groupLabel: 'Źródło stawki — z narzędziami (podwykonawca)',
        label: 'Kwota stała (3)',
        active: false,
      },
    ])
  })

  it('drops a filter matching every praca — ticking it would narrow nothing', () => {
    expect(model({ [AMOUNT]: ROW_COUNT })).toEqual([])
  })

  it('keeps an engaged filter at (0), ticked, so it can come off', () => {
    const toggles = model({ [COEFF]: 0 }, [COEFF])
    expect(toggles).toEqual([expect.objectContaining({ id: COEFF, active: true })])
    expect(toggles[0]?.label).toMatch(/\(0\)$/)
  })

  it('offers the residual „nie dotyczy" beside ponad and w granicy', () => {
    const labels = model({
      'catalogue-over-ceiling-w_tools': 2,
      'catalogue-within-ceiling-w_tools': 5,
      'catalogue-ceiling-na-w_tools': 3,
    }).map((toggle) => [toggle.groupLabel, toggle.label])
    const group = 'Udział w cenie — z narzędziami (podwykonawca)'
    expect(labels).toEqual([
      [group, 'Ponad 65% (2)'],
      [group, 'W granicy 65% (5)'],
      [group, 'Nie dotyczy (auto lub bez ceny j.m.) (3)'],
    ])
  })
})
