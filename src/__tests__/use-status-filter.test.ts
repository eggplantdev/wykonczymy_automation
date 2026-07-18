import { describe, it, expect } from 'vitest'
import { filterByStatusView, type StatusViewT } from '@/hooks/use-status-filter'
import type { InvestmentStatusT } from '@/types/reference-data'

type RowT = { id: number; status: InvestmentStatusT }

const rows: RowT[] = [
  { id: 1, status: 'planowana' },
  { id: 2, status: 'active' },
  { id: 3, status: 'completed' },
]

const idsFor = (view: StatusViewT) =>
  filterByStatusView(rows, view, (r) => r.status)
    .map((r) => r.id)
    .sort()

describe('filterByStatusView', () => {
  it('open (default) → active + planowana, hides completed', () => {
    expect(idsFor('open')).toEqual([1, 2])
  })

  it('planowana → only prospects', () => {
    expect(idsFor('planowana')).toEqual([1])
  })

  it('active → only active', () => {
    expect(idsFor('active')).toEqual([2])
  })

  it('completed → only completed', () => {
    expect(idsFor('completed')).toEqual([3])
  })

  it('all → every row', () => {
    expect(idsFor('all')).toEqual([1, 2, 3])
  })
})
