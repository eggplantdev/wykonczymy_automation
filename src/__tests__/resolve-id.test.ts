import { describe, it, expect } from 'vitest'

import { entityTag, CACHE_TAGS } from '@/lib/cache/tags'
import { resolveId } from '@/lib/utils/resolve-id'

describe('resolveId', () => {
  it('returns number directly', () => {
    expect(resolveId(42)).toBe(42)
  })

  it('returns 0 for numeric zero', () => {
    expect(resolveId(0)).toBe(0)
  })

  it('extracts id from populated object', () => {
    expect(resolveId({ id: 10, name: 'Register A' })).toBe(10)
  })

  it('returns undefined for null', () => {
    expect(resolveId(null)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(resolveId(undefined)).toBeUndefined()
  })

  it('returns undefined for string', () => {
    expect(resolveId('42')).toBeUndefined()
  })

  it('returns undefined for object without id', () => {
    expect(resolveId({ name: 'no id' })).toBeUndefined()
  })
})

// ── entityTag ────────────────────────────────────────────────────────────

describe('entityTag', () => {
  it('builds tag from collection and numeric id', () => {
    expect(entityTag('cash-register', 5)).toBe('cash-register:5')
  })

  it('builds tag from collection and string id', () => {
    expect(entityTag('investment', '10')).toBe('investment:10')
  })
})

// ── CACHE_TAGS ───────────────────────────────────────────────────────────

describe('CACHE_TAGS', () => {
  it('has expected keys', () => {
    expect(CACHE_TAGS).toHaveProperty('transfers')
    expect(CACHE_TAGS).toHaveProperty('cashRegisters')
    expect(CACHE_TAGS).toHaveProperty('investments')
    expect(CACHE_TAGS).toHaveProperty('users')
    expect(CACHE_TAGS).toHaveProperty('otherCategories')
  })

  it('values follow collection: prefix pattern', () => {
    for (const value of Object.values(CACHE_TAGS)) {
      expect(value).toMatch(/^collection:.+/)
    }
  })
})
