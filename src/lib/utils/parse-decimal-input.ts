export type DecimalInputParseT =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'value'; value: number }

// Shared numeric-input parse for the kosztorys editor's decimal fields (subcontractor coeff/price,
// markup coefficient, rabat value). The convention lives in one place: accept a comma as the decimal
// separator, treat blank as "clear", and REJECT (not clear) mid-typing garbage like "1e" or "-" so a
// half-typed value never wipes the field. Each call site maps the three outcomes to its own action.
export function parseDecimalInput(raw: string): DecimalInputParseT {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return { kind: 'empty' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { kind: 'invalid' }
  return { kind: 'value', value }
}
