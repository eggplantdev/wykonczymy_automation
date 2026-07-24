import { describe, it, expect } from 'vitest'
import { filterByStatuses } from '@/hooks/use-status-filter'
import type { InvestmentStatusT } from '@/types/reference-data'

type RowT = { id: number; status: InvestmentStatusT }

const rows: RowT[] = [
  { id: 1, status: 'planowana' },
  { id: 2, status: 'active' },
  { id: 3, status: 'completed' },
]

const idsFor = (selected: InvestmentStatusT[]) =>
  filterByStatuses(rows, new Set(selected), (r) => r.status)
    .map((r) => r.id)
    .sort()

describe('filterByStatuses', () => {
  it('default (active + planowana) → hides completed', () => {
    expect(idsFor(['active', 'planowana'])).toEqual([1, 2])
  })

  it('planowana only → only prospects', () => {
    expect(idsFor(['planowana'])).toEqual([1])
  })

  it('active only → only active', () => {
    expect(idsFor(['active'])).toEqual([2])
  })

  it('completed only → only completed', () => {
    expect(idsFor(['completed'])).toEqual([3])
  })

  it('all three selected → every row', () => {
    expect(idsFor(['planowana', 'active', 'completed'])).toEqual([1, 2, 3])
  })

  it('none selected → no rows', () => {
    expect(idsFor([])).toEqual([])
  })
})
