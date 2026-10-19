import { describe, it, expect } from 'vitest'
import { getRelationName } from '@/lib/utils/get-relation-name'

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
})
