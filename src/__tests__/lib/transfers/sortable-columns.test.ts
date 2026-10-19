import { describe, it, expect } from 'vitest'
import { DEFAULT_TRANSFER_SORT, transferSort } from '@/lib/transfers/sortable-columns'

// A value off the whitelist would reach `payload.find` and, worse, mint its own `unstable_cache`
// entry — so every rejection path has to land on the default rather than throw or pass through.
describe('transferSort.parse', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(transferSort.parse({ sort: 'amount' })).toBe('amount')
    expect(transferSort.parse({ sort: '-amount' })).toBe('-amount')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-investmentName' }],
    ['relational column', { sort: 'investment' }],
    ['array value', { sort: ['amount', 'date'] }],
    ['bare minus', { sort: '-' }],
  ])('falls back to the default for %s', (_label, searchParams) => {
    expect(transferSort.parse(searchParams)).toBe(DEFAULT_TRANSFER_SORT)
  })
})

describe('transferSort.valid', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(transferSort.valid('amount')).toBe('amount')
    expect(transferSort.valid('-date')).toBe('-date')
  })

  it.each(['investment', 'investment.name', 'netAmount', 'settled', '-', '', undefined])(
    'refuses %p so the caller falls back to its own default',
    (param) => {
      expect(transferSort.valid(param)).toBeUndefined()
    },
  )
})
