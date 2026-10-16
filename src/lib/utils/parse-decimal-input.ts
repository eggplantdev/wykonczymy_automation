import { evaluateArithmetic } from '@/lib/utils/evaluate-arithmetic'
import { roundToCents } from '@/lib/utils/round-to-cents'

export type DecimalInputParseT =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'value'; value: number }

// `decimalText` (decimal-text.ts) is the inverse — the two are one convention and change together.
export function parseDecimalInput(raw: string): DecimalInputParseT {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return { kind: 'empty' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { kind: 'invalid' }
  return { kind: 'value', value }
}

// Interior whitespace is stripped because a figure copied from the owner's sheet carries an NBSP
// thousands separator.
export function parseCellDecimal(raw: string): DecimalInputParseT {
  const compact = raw.replace(/\s/g, '')
  const plain = parseDecimalInput(compact)
  if (plain.kind !== 'invalid') return plain
  const result = evaluateArithmetic(compact)
  return result === null ? plain : { kind: 'value', value: roundToCents(result) }
}

export function toMoney(value: string): number {
  const parsed = parseDecimalInput(value)
  return parsed.kind === 'value' ? parsed.value : NaN
}
