import { describe, expect, it } from 'vitest'
import { decimalText } from '@/lib/utils/decimal-text'
import { parseCellDecimal, parseDecimalInput, toMoney } from '@/lib/utils/parse-decimal-input'

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

// A grid cell renders with `decimalText` and reads back with `parseCellDecimal` on the next
// keystroke. Break the round trip and an untouched cell re-commits a different number than it showed.
describe('parseCellDecimal(decimalText(x)) round trip', () => {
  it.each([0, 1, -3, 12.5, 0.01, 1234567.89, 1e21, -0.5])('survives %s', (value) => {
    expect(parseCellDecimal(decimalText(value))).toEqual({ kind: 'value', value })
  })

  it('reads a figure pasted from the sheet with its NBSP thousands separator', () => {
    expect(parseCellDecimal('1\u00a0234,50')).toEqual({ kind: 'value', value: 1234.5 })
  })

  it('keeps the form parse strict, where interior whitespace is a typo and not a separator', () => {
    expect(parseDecimalInput('1 2')).toEqual({ kind: 'invalid' })
  })

  it('renders null/undefined as the empty cell that parses back to a clear', () => {
    expect(parseCellDecimal(decimalText(null))).toEqual({ kind: 'empty' })
    expect(parseCellDecimal(decimalText(undefined))).toEqual({ kind: 'empty' })
  })
})

describe('toMoney', () => {
  it('reads a comma as the decimal separator', () => {
    expect(toMoney('12,50')).toBe(12.5)
  })

  it('refuses a blank field instead of reading it as 0 zł', () => {
    expect(toMoney('')).toBeNaN()
    expect(toMoney('   ')).toBeNaN()
  })

  it('refuses half-typed garbage', () => {
    expect(toMoney('1e')).toBeNaN()
    expect(toMoney('-')).toBeNaN()
  })
})
