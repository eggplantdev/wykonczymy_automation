import { evaluateArithmetic } from '@/lib/utils/evaluate-arithmetic'
import { roundToCents } from '@/lib/utils/round-to-cents'

export type DecimalInputParseT =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'value'; value: number }

// Shared numeric-input parse for the kosztorys editor's decimal fields (subcontractor coeff/price,
// markup coefficient, rabat value): accept a comma as the decimal separator, treat blank as "clear",
// and REJECT (not clear) mid-typing garbage like "1e" or "-" so a half-typed value never wipes the
// field. Each call site maps the three outcomes to its own action. `decimalText` (decimal-text.ts) is
// the inverse — the two are one convention and change together.
export function parseDecimalInput(raw: string): DecimalInputParseT {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return { kind: 'empty' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { kind: 'invalid' }
  return { kind: 'value', value }
}

// The same parse as a GRID cell accepts it. Interior whitespace is stripped because a figure copied
// from the owner's sheet carries an NBSP thousands separator, and a cell must accept it by whichever
// route it arrives — typed, pasted into an open cell, or pasted onto a selection. The form fields
// deliberately keep the strict parse above: there, „1 2" is a typo, not a thousands separator.
//
// A cell also takes the arithmetic the owner types into the sheet („3,5x2,8"). Only text the plain
// parse refuses reaches the evaluator, so a typed number keeps its exact `decimalText` round trip;
// an expression's result is rounded, or 10/3 would leave a float tail in the cell.
export function parseCellDecimal(raw: string): DecimalInputParseT {
  const compact = raw.replace(/\s/g, '')
  const plain = parseDecimalInput(compact)
  if (plain.kind !== 'invalid') return plain
  const result = evaluateArithmetic(compact)
  return result === null ? plain : { kind: 'value', value: roundToCents(result) }
}

// „12,50" → 12.5; blank and garbage → NaN. The third mapping of the three outcomes above, for a
// caller that hands the figure straight to a Zod `money()` — which refuses NaN — instead of reacting
// to „puste" and „śmieci" separately.
export function toMoney(value: string): number {
  const parsed = parseDecimalInput(value)
  return parsed.kind === 'value' ? parsed.value : NaN
}
