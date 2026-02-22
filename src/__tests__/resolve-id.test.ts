import { describe, it, expect, vi } from 'vitest'

// resolveId is not exported — we need to test it via the hooks.
// Instead, we re-implement the same logic inline for unit testing.
// The canonical version lives in src/hooks/transfers/recalculate-balances.ts:8-14
// If that logic changes, this test should be updated.

// We can test the entityTag helper which IS exported.
import { entityTag, CACHE_TAGS } from '@/lib/cache/tags'

// ── resolveId (re-implemented for isolated testing) ──────────────────────

const resolveId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}

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
