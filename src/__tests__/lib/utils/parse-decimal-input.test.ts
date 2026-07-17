import { describe, expect, it } from 'vitest'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

describe('parseDecimalInput', () => {
  it('parsuje liczbę i przyjmuje przecinek jako separator dziesiętny', () => {
    expect(parseDecimalInput('12.5')).toEqual({ kind: 'value', value: 12.5 })
    expect(parseDecimalInput('12,5')).toEqual({ kind: 'value', value: 12.5 })
    expect(parseDecimalInput('  -3  ')).toEqual({ kind: 'value', value: -3 })
  })

  it('puste / same białe znaki → empty (wyczyszczenie)', () => {
    expect(parseDecimalInput('')).toEqual({ kind: 'empty' })
    expect(parseDecimalInput('   ')).toEqual({ kind: 'empty' })
  })

  it('niedokończony wpis → invalid (nie kasuje pola)', () => {
    expect(parseDecimalInput('1e')).toEqual({ kind: 'invalid' })
    expect(parseDecimalInput('-')).toEqual({ kind: 'invalid' })
    expect(parseDecimalInput('abc')).toEqual({ kind: 'invalid' })
  })

  // Number('Infinity')/Number('1e999') aren't NaN, so a bare Number.isNaN guard would commit them
  // as a live value into every consuming action. Non-finite input is invalid, not a number.
  it('odrzuca wartości ni-skończone', () => {
    expect(parseDecimalInput('Infinity')).toEqual({ kind: 'invalid' })
    expect(parseDecimalInput('-Infinity')).toEqual({ kind: 'invalid' })
    expect(parseDecimalInput('1e999')).toEqual({ kind: 'invalid' })
  })
})
