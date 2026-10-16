import { parseDecimalInput, type DecimalInputParseT } from '@/lib/utils/parse-decimal-input'

export function parseReportQty(raw: string): DecimalInputParseT {
  const parsed = parseDecimalInput(raw)
  if (parsed.kind !== 'value') return parsed
  if (parsed.value < 0) return { kind: 'invalid' }
  if (parsed.value === 0) return { kind: 'empty' }
  return parsed
}
