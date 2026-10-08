import { describe, expect, it } from 'vitest'
import { normalizeNip } from '@/lib/utils/nip'

describe('normalizeNip', () => {
  it.each([
    ['5213456789', '5213456789'],
    ['PL5213456789', '5213456789'],
    ['pl 521-345-67-89', '5213456789'],
    ['521 34 56 789', '5213456789'],
    ['  521-34-56-789  ', '5213456789'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeNip(raw)).toBe(expected)
  })

  it.each(['', '521345678', '52134567890', 'PL52134567AB', 'brak'])('rejects %j', (raw) => {
    expect(normalizeNip(raw)).toBeUndefined()
  })
})
