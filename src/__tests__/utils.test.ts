import { describe, it, expect } from 'vitest'
import { getMonthDateRange } from '@/lib/utils/date'
import {
  parsePagination,
  buildPaginationMeta,
  DEFAULT_LIMIT,
  ALLOWED_LIMITS,
} from '@/lib/pagination'
import { buildUrlWithParams } from '@/lib/build-url-with-params'
import { formatPLN } from '@/lib/format-currency'
import { getRelationName } from '@/lib/get-relation-name'

// ── getMonthDateRange ────────────────────────────────────────────────────

describe('getMonthDateRange', () => {
  it('returns correct range for January', () => {
    expect(getMonthDateRange(1, 2024)).toEqual({ from: '2024-01-01', to: '2024-01-31' })
  })

  it('returns correct range for February (non-leap year)', () => {
    expect(getMonthDateRange(2, 2023)).toEqual({ from: '2023-02-01', to: '2023-02-28' })
  })

  it('returns correct range for February (leap year)', () => {
    expect(getMonthDateRange(2, 2024)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('returns correct range for December', () => {
    expect(getMonthDateRange(12, 2024)).toEqual({ from: '2024-12-01', to: '2024-12-31' })
  })

  it('returns correct range for April (30 days)', () => {
    expect(getMonthDateRange(4, 2024)).toEqual({ from: '2024-04-01', to: '2024-04-30' })
  })
})

// ── parsePagination ──────────────────────────────────────────────────────

describe('parsePagination', () => {
  it('returns defaults for empty params', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })

  it('parses valid page and limit', () => {
    expect(parsePagination({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 })
  })

  it('falls back to page 1 for page=0', () => {
    expect(parsePagination({ page: '0' })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })

  it('falls back to page 1 for negative page', () => {
    expect(parsePagination({ page: '-1' })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
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

// ── buildPaginationMeta ──────────────────────────────────────────────────

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

// ── buildUrlWithParams ───────────────────────────────────────────────────

describe('buildUrlWithParams', () => {
  it('adds params to a clean URL', () => {
    const url = buildUrlWithParams('/items', '', { page: '2', limit: '50' })
    expect(url).toContain('/items?')
    expect(url).toContain('page=2')
    expect(url).toContain('limit=50')
  })

  it('overwrites existing params', () => {
    const url = buildUrlWithParams('/items', 'page=1&limit=20', { page: '3' })
    expect(url).toContain('page=3')
    expect(url).toContain('limit=20')
  })

  it('deletes params with empty string value', () => {
    const url = buildUrlWithParams('/items', 'page=1&filter=abc', { filter: '' })
    expect(url).not.toContain('filter')
    expect(url).toContain('page=1')
  })

  it('returns clean URL when all params are deleted', () => {
    const url = buildUrlWithParams('/items', 'page=1', { page: '' })
    expect(url).toBe('/items')
  })

  it('returns clean URL when no overrides given and no existing params', () => {
    const url = buildUrlWithParams('/items', '', {})
    expect(url).toBe('/items')
  })
})

// ── formatPLN ────────────────────────────────────────────────────────────

describe('formatPLN', () => {
  it('formats integer amounts', () => {
    const result = formatPLN(1000)
    // Polish locale uses non-breaking space and "zł"
    expect(result).toContain('1')
    expect(result).toContain('000')
    expect(result).toContain('zł')
  })

  it('formats decimal amounts', () => {
    const result = formatPLN(1234.56)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
    expect(result).toContain('zł')
  })

  it('formats zero', () => {
    const result = formatPLN(0)
    expect(result).toContain('0')
    expect(result).toContain('zł')
  })

  it('formats negative amounts', () => {
    const result = formatPLN(-500)
    expect(result).toContain('500')
    expect(result).toContain('zł')
  })
})

// ── getRelationName ──────────────────────────────────────────────────────

describe('getRelationName', () => {
  it('returns name from populated object', () => {
    expect(getRelationName({ id: 1, name: 'Jan Kowalski' })).toBe('Jan Kowalski')
  })

  it('returns fallback for numeric ID', () => {
    expect(getRelationName(42)).toBe('—')
  })

  it('returns fallback for null', () => {
    expect(getRelationName(null)).toBe('—')
  })

  it('returns fallback for undefined', () => {
    expect(getRelationName(undefined)).toBe('—')
  })

  it('returns custom fallback', () => {
    expect(getRelationName(null, 'N/A')).toBe('N/A')
  })

  it('returns name from object with extra fields', () => {
    expect(getRelationName({ id: 1, name: 'Test', email: 'test@test.com' })).toBe('Test')
  })
})
