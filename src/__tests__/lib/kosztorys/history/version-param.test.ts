import { describe, expect, it } from 'vitest'
import { parseVersionParam } from '@/lib/kosztorys/history/version-param'

describe('parseVersionParam', () => {
  it('reads a positive integer id', () => {
    expect(parseVersionParam('42')).toBe(42)
  })

  it.each([
    ['absent', undefined],
    ['repeated', ['1', '2']],
    ['zero', '0'],
    ['negative', '-3'],
    ['fractional', '1.5'],
    ['exponent', '1e3'],
    ['past int4', '2147483648'],
    ['text', 'abc'],
  ])('falls back to the present when %s', (_, value) => {
    expect(parseVersionParam(value)).toBeUndefined()
  })
})
