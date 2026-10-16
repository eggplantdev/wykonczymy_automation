import { describe, expect, it } from 'vitest'
import { filterBySearch, foldHaystacks } from '@/hooks/use-search-filter'

type RowT = { name: string }

const rows: RowT[] = [{ name: 'Łazienka' }, { name: 'Źródło ciepła' }, { name: 'Salon' }]
const haystacks = foldHaystacks(rows, (row) => row.name)

const namesFor = (term: string) => filterBySearch(rows, haystacks, term).map((r) => r.name)

describe('filterBySearch', () => {
  it('reaches a Polish label from an ASCII query', () => {
    expect(namesFor('lazienka')).toEqual(['Łazienka'])
    expect(namesFor('zrodlo')).toEqual(['Źródło ciepła'])
  })

  it('still matches a correctly accented query', () => {
    expect(namesFor('Źródło')).toEqual(['Źródło ciepła'])
  })

  it('ignores case and surrounding whitespace', () => {
    expect(namesFor('  SALON ')).toEqual(['Salon'])
  })

  it('returns everything for an empty term', () => {
    expect(namesFor('')).toHaveLength(3)
  })

  it('returns nothing when no row matches', () => {
    expect(namesFor('kuchnia')).toEqual([])
  })
})
