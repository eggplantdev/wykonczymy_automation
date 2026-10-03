import { describe, expect, it } from 'vitest'
import { parseIdParam } from '@/lib/utils/parse-id-param'

describe('parseIdParam', () => {
  it('reads a positive integer id', () => {
    expect(parseIdParam('42')).toBe(42)
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
  ])('reads as absent when %s', (_, value) => {
    expect(parseIdParam(value)).toBeUndefined()
  })
})
