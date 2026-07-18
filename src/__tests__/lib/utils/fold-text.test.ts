import { describe, expect, it } from 'vitest'
import { foldFilter, foldText } from '@/lib/utils/fold-text'

describe('foldText', () => {
  it('strips Polish diacritics and lowercases', () => {
    expect(foldText('Źródło')).toBe('zrodlo')
    expect(foldText('Wartość')).toBe('wartosc')
    expect(foldText('Ilość')).toBe('ilosc')
  })

  it('folds ł/Ł, which NFD leaves intact', () => {
    expect(foldText('Łódź')).toBe('lodz')
    expect(foldText('Materiał')).toBe('material')
    expect(foldText('Wpłata')).toBe('wplata')
  })

  it('folds every Polish diacritic (ą ć ę ł ń ó ś ź ż)', () => {
    expect(foldText('Zażółć gęślą jaźń')).toBe('zazolc gesla jazn')
  })
})

describe('foldFilter', () => {
  it('matches an accent-free query against an accented label', () => {
    expect(foldFilter('Źródło', 'zrodlo')).toBe(1)
    expect(foldFilter('Wartość', 'wartosc')).toBe(1)
  })

  it('matches a lodz query against Łódź (the ł caveat, now closed)', () => {
    expect(foldFilter('Łódź', 'lodz')).toBe(1)
    expect(foldFilter('Materiał', 'material')).toBe(1)
  })

  it('matches on a contiguous substring, not a subsequence', () => {
    expect(foldFilter('Wartość', 'rtos')).toBe(1)
    // fuzzy subsequence (non-contiguous chars) must NOT match under the substring filter
    expect(foldFilter('Wartość', 'wrs')).toBe(0)
  })

  it('returns 0 when the query is absent', () => {
    expect(foldFilter('Źródło', 'xyz')).toBe(0)
  })
})
