import { describe, it, expect } from 'vitest'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { DEFAULT_TRANSFER_SORT } from '@/lib/transfers/sortable-columns'

// A value off the whitelist would reach `payload.find` and, worse, mint its own `unstable_cache`
// entry — so every rejection path has to land on the default rather than throw or pass through.
describe('parseTransferSort', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(parseTransferSort({ sort: 'amount' })).toBe('amount')
    expect(parseTransferSort({ sort: '-amount' })).toBe('-amount')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-investmentName' }],
    ['relational column', { sort: 'investment' }],
    ['array value', { sort: ['amount', 'date'] }],
    ['bare minus', { sort: '-' }],
  ])('falls back to the default for %s', (_label, searchParams) => {
    expect(parseTransferSort(searchParams)).toBe(DEFAULT_TRANSFER_SORT)
  })
})
