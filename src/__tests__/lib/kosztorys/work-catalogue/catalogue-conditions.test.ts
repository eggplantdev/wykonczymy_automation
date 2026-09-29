import { describe, expect, it } from 'vitest'
import {
  CATALOGUE_CONDITIONS,
  CATALOGUE_PROBLEM_IDS,
  applyCatalogueConditions,
  catalogueDuplicateCondition,
  catalogueUsageConditions,
  countCatalogueConditions,
} from '@/lib/kosztorys/work-catalogue/catalogue-conditions'
import { isCatalogueOverCeiling } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

let nextId = 1
const entry = (fields: Partial<WorkCatalogueItemT> = {}): WorkCatalogueItemT => ({
  id: nextId++,
  description: 'Malowanie',
  category: null,
  unit: 'm2',
  clientPrice: 100,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: 'malowanie|m2',
  ...fields,
})

const condition = (id: string) => {
  const found = CATALOGUE_CONDITIONS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no condition ${id}`)
  return found
}

const matches = (id: string, fields: Partial<WorkCatalogueItemT>) =>
  condition(id).matches(entry(fields))

describe('catalogue condition predicates', () => {
  it('„bez ceny" matches a zero or missing cena j.m.', () => {
    expect(matches('catalogue-no-price', { clientPrice: 0 })).toBe(true)
    expect(matches('catalogue-no-price', { clientPrice: 1 })).toBe(false)
  })

  it('„stawka 0" matches a zero kwota or mnożnik, never „auto"', () => {
    expect(matches('catalogue-zero-rate-w_tools', { wToolsRate: 0 })).toBe(true)
    expect(matches('catalogue-zero-rate-w_tools', { wToolsRateCoeff: 0 })).toBe(true)
    expect(matches('catalogue-zero-rate-w_tools', {})).toBe(false)
    expect(matches('catalogue-zero-rate-w_tools', { ownToolsRate: 0 })).toBe(false)
    expect(matches('catalogue-zero-rate-own_tools', { ownToolsRate: 0 })).toBe(true)
  })

  it('źródło reads the plane’s own columns', () => {
    expect(matches('catalogue-source-amount-w_tools', { wToolsRate: 50 })).toBe(true)
    expect(matches('catalogue-source-coeff-own_tools', { ownToolsRateCoeff: 0.5 })).toBe(true)
    expect(matches('catalogue-source-auto-own_tools', { wToolsRate: 50 })).toBe(true)
  })

  it('„ponad" agrees with the table’s red cell, per plane', () => {
    // 60 zł is under 65 % z narzędziami and over 55,25 % bez narzędzi.
    const fields = { wToolsRate: 60, ownToolsRate: 60 }
    expect(matches('catalogue-over-ceiling-w_tools', fields)).toBe(false)
    expect(matches('catalogue-over-ceiling-own_tools', fields)).toBe(true)
    expect(isCatalogueOverCeiling(entry(fields), 'own_tools')).toBe(true)
  })

  it('„w granicy" excludes „auto" and prace bez ceny', () => {
    expect(matches('catalogue-within-ceiling-w_tools', { wToolsRate: 50 })).toBe(true)
    expect(matches('catalogue-within-ceiling-w_tools', {})).toBe(false)
    expect(matches('catalogue-within-ceiling-w_tools', { wToolsRate: 50, clientPrice: 0 })).toBe(
      false,
    )
  })
})

describe('per-plane partition', () => {
  const rows = [
    entry({ wToolsRate: 50, ownToolsRate: 80 }),
    entry({ wToolsRateCoeff: 0.9, ownToolsRateCoeff: 0.3 }),
    entry({}),
    entry({ clientPrice: 0, wToolsRate: 10, ownToolsRateCoeff: 0.2 }),
    entry({ wToolsRate: 0, ownToolsRate: 55.25 }),
  ]

  it.each(['w_tools', 'own_tools'] as const)(
    '%s: ponad + w granicy + auto + non-auto bez ceny = every praca, exactly once',
    (plane) => {
      const buckets = [
        condition(`catalogue-over-ceiling-${plane}`).matches,
        condition(`catalogue-within-ceiling-${plane}`).matches,
        condition(`catalogue-source-auto-${plane}`).matches,
        (row: WorkCatalogueItemT) =>
          !condition(`catalogue-source-auto-${plane}`).matches(row) && !(row.clientPrice > 0),
      ]
      for (const row of rows) {
        expect(buckets.filter((bucket) => bucket(row))).toHaveLength(1)
      }
    },
  )
})

describe('countCatalogueConditions', () => {
  it('counts every condition over the rows it is given', () => {
    const rows = [entry({ clientPrice: 0 }), entry({ clientPrice: 0 }), entry({ wToolsRate: 0 })]
    const counts = countCatalogueConditions(rows, CATALOGUE_CONDITIONS)
    expect(counts.get('catalogue-no-price')).toBe(2)
    expect(counts.get('catalogue-zero-rate-w_tools')).toBe(1)
    expect(counts.get('catalogue-source-auto-own_tools')).toBe(3)
    expect(counts.size).toBe(CATALOGUE_CONDITIONS.length)
  })
})

describe('applyCatalogueConditions', () => {
  const amount = entry({ wToolsRate: 50 })
  const coeff = entry({ wToolsRateCoeff: 0.5 })
  const auto = entry({})
  const unpriced = entry({ clientPrice: 0 })
  const rows = [amount, coeff, auto, unpriced]

  it('engaged filters hide their matches and combine with AND', () => {
    const engaged = new Set(['catalogue-source-amount-w_tools', 'catalogue-source-coeff-w_tools'])
    expect(applyCatalogueConditions(rows, CATALOGUE_CONDITIONS, engaged)).toEqual([auto, unpriced])
  })

  it('an engaged problem keeps only its matches', () => {
    const engaged = new Set(['catalogue-no-price'])
    expect(applyCatalogueConditions(rows, CATALOGUE_CONDITIONS, engaged)).toEqual([unpriced])
  })

  it('ignores an id that names no condition', () => {
    const engaged = new Set(['catalogue-gone'])
    expect(applyCatalogueConditions(rows, CATALOGUE_CONDITIONS, engaged)).toEqual(rows)
  })
})

describe('registry', () => {
  it('lists exactly the problem ids for the exclusive pick', () => {
    expect(CATALOGUE_PROBLEM_IDS).toEqual([
      'catalogue-no-price',
      'catalogue-zero-rate-w_tools',
      'catalogue-zero-rate-own_tools',
      'catalogue-near-duplicate',
    ])
  })

  it('never repeats a label, which cmdk keys its rows by', () => {
    const labels = CATALOGUE_CONDITIONS.map((candidate) => candidate.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('catalogueDuplicateCondition', () => {
  it('is a problem matching exactly the wpisy that have a twin', () => {
    const [twin, single] = [entry(), entry()]
    const condition = catalogueDuplicateCondition(new Map([[twin.id, []]]))

    expect(condition.kind).toBe('problem')
    expect(CATALOGUE_PROBLEM_IDS).toContain(condition.id)
    expect([twin, single].filter(condition.matches)).toEqual([twin])
  })
})

describe('catalogueUsageConditions', () => {
  it('has no „Użycie" group before a count is taken', () => {
    expect(catalogueUsageConditions(null)).toEqual([])
  })

  it('„nieużywane" and „używane" partition the catalogue, a missing id counting as unused', () => {
    const used = entry()
    const zero = entry()
    const absent = entry()
    const rows = [used, zero, absent]
    const conditions = catalogueUsageConditions({
      byId: { [used.id]: 2, [zero.id]: 0 },
      otherUnitIds: [],
      uncatalogued: [],
    })
    const counts = countCatalogueConditions(rows, conditions)
    expect(counts.get('catalogue-usage-used')).toBe(1)
    expect(counts.get('catalogue-usage-unused')).toBe(2)
    expect(applyCatalogueConditions(rows, conditions, new Set(['catalogue-usage-unused']))).toEqual(
      [used],
    )
  })
})
