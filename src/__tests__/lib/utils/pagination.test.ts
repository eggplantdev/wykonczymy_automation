import { describe, it, expect } from 'vitest'
import { DEFAULT_LIMIT, parsePagination } from '@/lib/utils/pagination'

describe('parsePagination', () => {
  it('falls back to the caller default, and to 100 when none is given', () => {
    expect(parsePagination({}).limit).toBe(DEFAULT_LIMIT)
    expect(parsePagination({}, 50).limit).toBe(50)
  })

  it('lets the URL override the caller default with an allowed limit', () => {
    expect(parsePagination({ limit: '20' }, 50).limit).toBe(20)
  })

  // Off-list values come back as the caller's default, not the global one — otherwise a hand-edited
  // `?limit=999` would silently widen a list its page deliberately keeps short.
  it.each(['999', '0', '-50', 'abc', ''])('refuses %p and keeps the caller default', (limit) => {
    expect(parsePagination({ limit }, 50).limit).toBe(50)
  })

  it.each([
    ['no parameter', {}, 1],
    ['a positive page', { page: '4' }, 4],
    ['zero', { page: '0' }, 1],
    ['a negative page', { page: '-2' }, 1],
  ])('reads %s as page %i', (_label, searchParams, expected) => {
    expect(parsePagination(searchParams).page).toBe(expected)
  })
})
