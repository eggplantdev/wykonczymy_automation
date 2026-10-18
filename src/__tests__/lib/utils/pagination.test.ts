import { describe, it, expect } from 'vitest'
import {
  ALLOWED_LIMITS,
  DEFAULT_LIMIT,
  buildPaginationMeta,
  parsePagination,
} from '@/lib/utils/pagination'

describe('parsePagination', () => {
  it('falls back to the caller default, and to 100 when none is given', () => {
    expect(parsePagination({}).limit).toBe(DEFAULT_LIMIT)
    expect(parsePagination({}, 50).limit).toBe(50)
  })

  it('lets the URL override the caller default with an allowed limit', () => {
    expect(parsePagination({ limit: '20' }, 50).limit).toBe(20)
  })

  // otherwise a hand-edited `?limit=999` would silently widen a list its page deliberately keeps short.
  it.each(['999', '0', '-50', 'abc', ''])('refuses %p and keeps the caller default', (limit) => {
    expect(parsePagination({ limit }, 50).limit).toBe(50)
  })

  it.each([
    ['no parameter', {}, 1],
    ['a positive page', { page: '4' }, 4],
    ['zero', { page: '0' }, 1],
    ['a negative page', { page: '-2' }, 1],
    // Both reach a raw-SQL OFFSET, where Postgres refuses them and the page 500s.
    ['a fractional page', { page: '1.5' }, 1],
    ['an overflowing page', { page: '1e999' }, 1],
  ])('reads %s as page %i', (_label, searchParams, expected) => {
    expect(parsePagination(searchParams).page).toBe(expected)
  })

  it('falls back to page 1 for NaN page', () => {
    expect(parsePagination({ page: 'abc' })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })

  it('falls back to default limit for disallowed limit', () => {
    expect(parsePagination({ limit: '25' })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })

  it.each(ALLOWED_LIMITS)('accepts allowed limit %d', (limit) => {
    expect(parsePagination({ limit: String(limit) })).toEqual({ page: 1, limit })
  })

  it('ignores array values for page', () => {
    expect(parsePagination({ page: ['1', '2'] })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })
})

describe('buildPaginationMeta', () => {
  it('passes through all fields', () => {
    const result = buildPaginationMeta({ page: 2, totalPages: 5, totalDocs: 100 }, 20)
    expect(result).toEqual({
      currentPage: 2,
      totalPages: 5,
      totalDocs: 100,
      limit: 20,
    })
  })

  it('defaults currentPage to 1 when page is undefined', () => {
    const result = buildPaginationMeta({ totalPages: 1, totalDocs: 3 }, 20)
    expect(result.currentPage).toBe(1)
  })
})
