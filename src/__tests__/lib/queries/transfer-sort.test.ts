import { describe, it, expect } from 'vitest'
import { parseTransferSort, validTransferSort } from '@/lib/queries/transfer-sort'
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

// The print action takes its sort key from the client, so it re-validates here rather than trusting
// the page that rendered the button. Without this gate `?sort=investment` gave a screen ordered by
// `-id` and a printout Payload silently reordered to `-createdAt` — the divergence EX-777 closes.
describe('validTransferSort', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(validTransferSort('amount')).toBe('amount')
    expect(validTransferSort('-date')).toBe('-date')
  })

  it.each(['investment', 'investment.name', 'netAmount', 'settled', '-', '', undefined])(
    'refuses %p so the caller falls back to its own default',
    (param) => {
      expect(validTransferSort(param)).toBeUndefined()
    },
  )
})
