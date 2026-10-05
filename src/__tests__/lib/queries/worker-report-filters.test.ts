import { describe, it, expect } from 'vitest'
import { parseWorkerReportFilters } from '@/lib/queries/worker-report-filters'

describe('parseWorkerReportFilters', () => {
  it('leaves every dimension unfiltered when the URL names none', () => {
    expect(parseWorkerReportFilters({})).toEqual({
      statuses: null,
      investmentIds: null,
      workerIds: null,
      sentRange: { from: undefined, to: undefined },
    })
  })

  it('reads lists and an ISO day range', () => {
    expect(
      parseWorkerReportFilters({
        status: 'pending,rejected',
        investment: '4,9',
        worker: '12',
        from: '2026-10-01',
        to: '2026-10-05',
      }),
    ).toEqual({
      statuses: ['pending', 'rejected'],
      investmentIds: [4, 9],
      workerIds: [12],
      sentRange: { from: '2026-10-01', to: '2026-10-05' },
    })
  })

  it('empties a dimension the URL names with nothing valid, rather than showing everything', () => {
    const filters = parseWorkerReportFilters({ status: 'bogus', worker: 'abc', from: '01.10.2026' })

    expect(filters.statuses).toEqual([])
    expect(filters.workerIds).toEqual([])
    expect(filters.sentRange.from).toBeUndefined()
  })

  // Bound as a parameter against an `integer` column, an id past int4 is a Postgres error, not a miss.
  it('drops an id no integer column can hold', () => {
    expect(parseWorkerReportFilters({ worker: '99999999999,7' }).workerIds).toEqual([7])
  })
})
