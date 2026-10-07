import { describe, it, expect } from 'vitest'
import { parseExpenseDraftSort, validExpenseDraftSort } from '@/lib/queries/expense-draft-sort'

describe('parseExpenseDraftSort', () => {
  it('passes a whitelisted column through, ascending and descending', () => {
    expect(parseExpenseDraftSort({ sort: 'sentAt' })).toBe('sentAt')
    expect(parseExpenseDraftSort({ sort: '-decidedAt' })).toBe('-decidedAt')
  })

  it.each([
    ['no parameter', {}],
    ['empty string', { sort: '' }],
    ['unknown column', { sort: '-transferAmount' }],
    ['array value', { sort: ['sentAt', 'status'] }],
    ['bare minus', { sort: '-' }],
  ])('keeps the queue order for %s', (_label, searchParams) => {
    expect(parseExpenseDraftSort(searchParams)).toBeUndefined()
  })
})

describe('validExpenseDraftSort', () => {
  it('keeps a whitelisted key verbatim, sign included', () => {
    expect(validExpenseDraftSort('-workerName')).toBe('-workerName')
  })

  it.each(['id', '-', '', undefined])('refuses %p', (param) => {
    expect(validExpenseDraftSort(param)).toBeUndefined()
  })
})
