import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import isValidUrl from '@/lib/utils/is-valid-url'
import { refineAmount, refineDate } from '@/lib/utils/validation'

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

  it('returns false for an http(s) URL missing the // authority separator', () => {
    expect(isValidUrl('https:wykonczymy.vercel.app')).toBe(false)
  })
})

describe('refineAmount', () => {
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
