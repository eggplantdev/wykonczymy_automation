import { describe, it, expect } from 'vitest'
import { DEFAULT_LEAD_SORT, leadSort } from '@/lib/leads/sortable-columns'

// A value off the whitelist would reach `payload.find` and, worse, mint its own `unstable_cache`
// entry — so every rejection path has to land on the default rather than throw or pass through.
describe('leadSort.parse', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(leadSort.parse({ sort: 'submittedAt' })).toBe('submittedAt')
    expect(leadSort.parse({ sort: '-submittedAt' })).toBe('-submittedAt')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-nazwisko' }],
    ['a column built after the fetch', { sort: 'answers' }],
    ['array value', { sort: ['name', 'email'] }],
    ['bare minus', { sort: '-' }],
  ])('falls back to the default for %s', (_label, searchParams) => {
    expect(leadSort.parse(searchParams)).toBe(DEFAULT_LEAD_SORT)
  })
})

describe('leadSort.valid', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(leadSort.valid('name')).toBe('name')
    expect(leadSort.valid('-contactStatus')).toBe('-contactStatus')
  })

  it.each(['answers', 'details', 'rawData', '-', '', undefined])(
    'refuses %p so the caller falls back to its own default',
    (param) => {
      expect(leadSort.valid(param)).toBeUndefined()
    },
  )
})
