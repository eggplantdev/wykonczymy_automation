import { columnLetter } from '@/lib/google/sheet-configs'

// The lookbehind is what keeps „R" from matching inside
// „AR12" — a false hit there would mistake an unrelated formula for one chained off the cell we
// asked about.
export function referencesColumn(column: number): (formula: unknown) => boolean {
  const pattern = new RegExp(`(?<![A-Z])\\$?${columnLetter(column)}(\\$?\\d|\\s*:)`)
  return (formula: unknown): boolean =>
    typeof formula === 'string' && formula.startsWith('=') && pattern.test(formula.toUpperCase())
}

export function referencesAnyColumn(columns: number[]): (formula: unknown) => boolean {
  const matchers = columns.map(referencesColumn)
  return (formula: unknown): boolean => matchers.some((matches) => matches(formula))
}
