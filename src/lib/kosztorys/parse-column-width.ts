import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

export function parseColumnWidth(text: string, minPx: number): number | undefined {
  const parsed = parseDecimalInput(text)
  if (parsed.kind !== 'value' || parsed.value <= 0) return undefined
  return Math.max(minPx, Math.round(parsed.value))
}
