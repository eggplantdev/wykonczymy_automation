import { describe, it, expect } from 'vitest'
import isValidUrl from '@/lib/utils/is-valid-url'

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
