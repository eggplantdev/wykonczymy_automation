import { describe, it, expect } from 'vitest'
import { parseLeadSort, validLeadSort } from '@/lib/queries/lead-sort'
import { DEFAULT_LEAD_SORT } from '@/lib/leads/sortable-columns'

// A value off the whitelist would reach `payload.find` and, worse, mint its own `unstable_cache`
// entry — so every rejection path has to land on the default rather than throw or pass through.
describe('parseLeadSort', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(parseLeadSort({ sort: 'submittedAt' })).toBe('submittedAt')
    expect(parseLeadSort({ sort: '-submittedAt' })).toBe('-submittedAt')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-nazwisko' }],
    ['a column built after the fetch', { sort: 'answers' }],
    ['array value', { sort: ['name', 'email'] }],
    ['bare minus', { sort: '-' }],
  ])('falls back to the default for %s', (_label, searchParams) => {
    expect(parseLeadSort(searchParams)).toBe(DEFAULT_LEAD_SORT)
  })
})

describe('validLeadSort', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(validLeadSort('name')).toBe('name')
    expect(validLeadSort('-contactStatus')).toBe('-contactStatus')
  })

  it.each(['answers', 'details', 'rawData', '-', '', undefined])(
    'refuses %p so the caller falls back to its own default',
    (param) => {
      expect(validLeadSort(param)).toBeUndefined()
    },
  )
})
