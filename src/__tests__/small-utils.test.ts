import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseDateRange } from '@/lib/parse-date-range'
import isValidUrl from '@/lib/isValidUrl'
import { refineAmount, refineDate } from '@/lib/validation-utils'

// ── parseDateRange ───────────────────────────────────────────────────────

describe('parseDateRange', () => {
  it('returns range when both from and to present', () => {
    expect(parseDateRange({ from: '2024-01-01', to: '2024-01-31' })).toEqual({
      from: '2024-01-01',
      to: '2024-01-31',
    })
  })

  it('returns undefined when only from present', () => {
    expect(parseDateRange({ from: '2024-01-01' })).toBeUndefined()
  })

  it('returns undefined when only to present', () => {
    expect(parseDateRange({ to: '2024-01-31' })).toBeUndefined()
  })

  it('returns undefined when neither present', () => {
    expect(parseDateRange({})).toBeUndefined()
  })

  it('ignores array values', () => {
    expect(parseDateRange({ from: ['2024-01-01'], to: '2024-01-31' })).toBeUndefined()
  })

  it('ignores empty string from', () => {
    expect(parseDateRange({ from: '', to: '2024-01-31' })).toBeUndefined()
  })
})

// ── isValidUrl ───────────────────────────────────────────────────────────

describe('isValidUrl', () => {
  it('returns true for valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
  })

  it('returns true for valid https URL', () => {
    expect(isValidUrl('https://example.com/path?q=1')).toBe(true)
  })

  it('returns false for plain string', () => {
    expect(isValidUrl('not a url')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidUrl('')).toBe(false)
  })

  it('returns false for relative path', () => {
    expect(isValidUrl('/some/path')).toBe(false)
  })

  it('returns true for data URI', () => {
    expect(isValidUrl('data:text/plain;base64,aGVsbG8=')).toBe(true)
  })
})

// ── refineAmount ─────────────────────────────────────────────────────────

describe('refineAmount', () => {
  // Use a Zod schema to exercise the refinement
  const schema = z.object({ amount: z.string() }).superRefine((data, ctx) => {
    refineAmount(data, ctx)
  })

  it('passes for valid positive amount', () => {
    expect(schema.safeParse({ amount: '100' }).success).toBe(true)
  })

  it('fails for empty string', () => {
    expect(schema.safeParse({ amount: '' }).success).toBe(false)
  })

  it('fails for zero', () => {
    expect(schema.safeParse({ amount: '0' }).success).toBe(false)
  })

  it('fails for negative amount', () => {
    expect(schema.safeParse({ amount: '-50' }).success).toBe(false)
  })

  it('passes for decimal amount', () => {
    expect(schema.safeParse({ amount: '0.01' }).success).toBe(true)
  })
})

// ── refineDate ───────────────────────────────────────────────────────────

describe('refineDate', () => {
  const schema = z.object({ date: z.string() }).superRefine((data, ctx) => {
    refineDate(data, ctx)
  })

  it('passes for non-empty date string', () => {
    expect(schema.safeParse({ date: '2024-01-15' }).success).toBe(true)
  })

  it('fails for empty date string', () => {
    const result = schema.safeParse({ date: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Data jest wymagana')
    }
  })
})
