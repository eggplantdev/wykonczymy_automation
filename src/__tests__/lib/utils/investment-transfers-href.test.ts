import { describe, it, expect } from 'vitest'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'

// Every link into the transfers list used to be its own template literal, and one of them drifted
// from `buildTransferFilters`' contract — it filtered out the very row it pointed at (EX-581). These
// pin the query shape the filter parses: `type` comma-separated and unescaped, `id`/`worker` plain.
describe('investmentTransfersHref', () => {
  it('joins a multi-type filter with a literal comma', () => {
    expect(investmentTransfersHref(7, { types: DEPOSIT_TYPES })).toBe(
      `/inwestycje/7?type=${DEPOSIT_TYPES.join(',')}`,
    )
    expect(investmentTransfersHref(7, { types: DEPOSIT_TYPES })).not.toContain('%2C')
  })

  it('orders the params type, worker, id', () => {
    expect(investmentTransfersHref(7, { types: ['PAYOUT'], worker: 3 })).toBe(
      '/inwestycje/7?type=PAYOUT&worker=3',
    )
    expect(investmentTransfersHref(7, { types: ['CORRECTION'], id: 12 })).toBe(
      '/inwestycje/7?type=CORRECTION&id=12',
    )
  })

  // An empty type list must not become `?type=`, which `buildTransferFilters` reads as "no valid
  // type" and answers with zero rows.
  it('drops the query entirely when nothing filters', () => {
    expect(investmentTransfersHref(7)).toBe('/inwestycje/7')
    expect(investmentTransfersHref(7, { types: [] })).toBe('/inwestycje/7')
  })

  it('keeps a zero id and a zero worker', () => {
    expect(investmentTransfersHref(7, { id: 0, worker: 0 })).toBe('/inwestycje/7?worker=0&id=0')
  })
})
