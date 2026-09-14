import { describe, expect, it } from 'vitest'
import { activeFiltersModel } from '@/components/kosztorys/editor/toolbar/active-filters-model'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'

const NOTHING_ENGAGED = {
  engagedIds: new Set<string>(),
  collapsedSectionCount: 0,
  search: '',
  counts: new Map<string, number>(),
}

describe('activeFiltersModel', () => {
  it('shows nothing while nothing hides pozycje', () => {
    expect(activeFiltersModel(NOTHING_ENGAGED)).toEqual([])
  })

  it('names every source that can shorten the grid', () => {
    const chips = activeFiltersModel({
      ...NOTHING_ENGAGED,
      engagedIds: new Set(['no-planned-qty', 'no-client-price']),
      collapsedSectionCount: 3,
      search: 'gładź',
    })

    expect(chips.map((chip) => chip.removal)).toEqual([
      'condition',
      'problem',
      'sections',
      'search',
    ])
  })

  // The bar is read as „why is the grid short" — a source it stayed silent about would answer that
  // question wrongly, not incompletely.
  it.each([
    ['a filter', { engagedIds: new Set(['no-planned-qty']) }],
    ['a problem', { engagedIds: new Set(['no-client-price']) }],
    ['folded sekcje', { collapsedSectionCount: 2 }],
    ['a search phrase', { search: 'gips' }],
  ])('reports %s on its own', (_name, engaged) => {
    expect(activeFiltersModel({ ...NOTHING_ENGAGED, ...engaged })).toHaveLength(1)
  })

  it('says which way each kind pulls, since the two are opposite', () => {
    const [filter, problem] = activeFiltersModel({
      ...NOTHING_ENGAGED,
      engagedIds: new Set(['no-planned-qty', 'no-client-price']),
    })

    expect(filter.label).toMatch(/^Ukryto: /)
    expect(problem.label).toMatch(/^Tylko: /)
  })

  it('folds every collapsed sekcja into one chip carrying the number', () => {
    const [chip] = activeFiltersModel({ ...NOTHING_ENGAGED, collapsedSectionCount: 12 })

    expect(chip).toMatchObject({ removal: 'sections', count: 12 })
  })

  // A count over the survivors would count itself and move on every unrelated click.
  it('takes each count from the whole kosztorys, not from what is left', () => {
    const [chip] = activeFiltersModel({
      ...NOTHING_ENGAGED,
      engagedIds: new Set(['no-planned-qty']),
      counts: new Map([['no-planned-qty', 41]]),
    })

    expect(chip.count).toBe(41)
  })

  it('quotes the phrase back, and ignores one that is only whitespace', () => {
    expect(activeFiltersModel({ ...NOTHING_ENGAGED, search: 'gładź' })[0].label).toContain('gładź')
    expect(activeFiltersModel({ ...NOTHING_ENGAGED, search: '   ' })).toEqual([])
  })

  // A client condition is engaged by the investment's stored settings, not by a reading gesture, so
  // an X for it would offer to edit a saved setting from a control that undoes gestures.
  it('never offers to remove a client condition', () => {
    const clientIds = ROW_CONDITIONS.filter((condition) => condition.kind === 'client').map(
      (condition) => condition.id,
    )
    expect(clientIds.length).toBeGreaterThan(0)

    expect(activeFiltersModel({ ...NOTHING_ENGAGED, engagedIds: new Set(clientIds) })).toEqual([])
  })

  it('lists filters in registry order, the order the „Filtry" menu uses', () => {
    const filterIds = ROW_CONDITIONS.filter((condition) => condition.kind === 'filter').map(
      (condition) => condition.id,
    )
    const chips = activeFiltersModel({ ...NOTHING_ENGAGED, engagedIds: new Set(filterIds) })

    expect(chips.map((chip) => chip.id)).toEqual(filterIds)
  })

  it('gives every chip a key of its own, so React can tell them apart', () => {
    const chips = activeFiltersModel({
      engagedIds: new Set([...PROBLEM_IDS, 'no-planned-qty']),
      collapsedSectionCount: 1,
      search: 'x',
      counts: new Map(),
    })

    expect(new Set(chips.map((chip) => chip.id)).size).toBe(chips.length)
  })
})
