import { roundToCents } from '@/lib/utils/round-to-cents'

/**
 * `formatQty` / `formatNet` go through `toLocaleString`, which inserts a NBSP thousands separator and
 * rounds to a fixed precision — the text they produce does not parse back to the number it came from
 */
export const decimalText = (value: number | null | undefined): string =>
  value == null ? '' : String(value).replace('.', ',')

export const moneyText = (value: number): string => decimalText(roundToCents(value))
