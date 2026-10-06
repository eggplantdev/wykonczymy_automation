import { describe, it, expect } from 'vitest'
import { isExpenseDraftStatus } from '@/lib/constants/worker-expense-drafts'
import { isReportStatus } from '@/lib/kosztorys/worker-report/report-status'
import { parseQueueFilters } from '@/lib/queries/queue-filters'

describe('parseQueueFilters', () => {
  it('leaves every dimension unfiltered when the URL names none', () => {
    expect(parseQueueFilters({}, isReportStatus)).toEqual({
      statuses: null,
      investmentIds: null,
      workerIds: null,
      sentRange: { from: undefined, to: undefined },
    })
  })

  it('reads lists and an ISO day range', () => {
    expect(
      parseQueueFilters(
        {
          status: 'pending,rejected',
          investment: '4,9',
          worker: '12',
          from: '2026-10-01',
          to: '2026-10-05',
        },
        isReportStatus,
      ),
    ).toEqual({
      statuses: ['pending', 'rejected'],
      investmentIds: [4, 9],
      workerIds: [12],
      sentRange: { from: '2026-10-01', to: '2026-10-05' },
    })
  })

  it('keeps only the statuses the given guard accepts', () => {
    const isPending = (value: string): value is 'pending' => value === 'pending'

    expect(parseQueueFilters({ status: 'pending,accepted' }, isPending).statuses).toEqual([
      'pending',
    ])
  })

  it('empties a dimension the URL names with nothing valid, rather than showing everything', () => {
    const filters = parseQueueFilters(
      { status: 'bogus', worker: 'abc', from: '01.10.2026' },
      isExpenseDraftStatus,
    )

    expect(filters.statuses).toEqual([])
    expect(filters.workerIds).toEqual([])
    expect(filters.sentRange.from).toBeUndefined()
  })

  // Bound as a parameter against an `integer` column, an id past int4 is a Postgres error, not a miss.
  it('drops an id no integer column can hold', () => {
    expect(parseQueueFilters({ worker: '99999999999,7' }, isReportStatus).workerIds).toEqual([7])
  })
})
