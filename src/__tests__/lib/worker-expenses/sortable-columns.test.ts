import { describe, it, expect } from 'vitest'
import { expenseDraftSort } from '@/lib/worker-expenses/sortable-columns'

describe('expenseDraftSort.parse', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(expenseDraftSort.parse({ sort: 'sentAt' })).toBe('sentAt')
    expect(expenseDraftSort.parse({ sort: '-decidedAt' })).toBe('-decidedAt')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-transferAmount' }],
    ['array value', { sort: ['sentAt', 'status'] }],
    ['bare minus', { sort: '-' }],
  ])('keeps the queue order for %s', (_label, searchParams) => {
    expect(expenseDraftSort.parse(searchParams)).toBeUndefined()
  })
})

describe('expenseDraftSort.valid', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(expenseDraftSort.valid('-workerName')).toBe('-workerName')
  })

  it.each(['id', '-', '', undefined])('refuses %p', (param) => {
    expect(expenseDraftSort.valid(param)).toBeUndefined()
  })
})
