import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import type { PriceSourceT, ToolPlaneT } from '@/lib/kosztorys/types'

export const formatNet = (n: number) =>
  roundToCents(n).toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export const formatQty = (n: number) =>
  (n + 0).toLocaleString('pl-PL', { maximumFractionDigits: 3 })

export const formatQtyWithUnit = (qty: number, unit: string | null) =>
  [formatQty(qty), unit].filter(Boolean).join(' ')

export const unitLabel = (unit: string | null | undefined) => unit || 'bez j.m.'

export const formatCoeff = (n: number) =>
  (n + 0).toLocaleString('pl-PL', { maximumFractionDigits: 6 })

export const formatRate = (
  value: number | null,
  source: PriceSourceT,
  coeff: number | null,
): string => {
  if (source === 'auto') return 'auto'
  if (source === 'amount') return value === null ? 'auto' : formatPLN(value)
  const multiple = `×${formatCoeff(coeff ?? 0)}`
  return value === null ? multiple : `${multiple} (${formatPLN(value)})`
}

// Only an exact 100% prints as „100%": the cell is red past the agreed scope, so a red „100%" reads
// as a false alarm, and a grey one reads as done when a sliver is still owed.
export const formatPercent = (fraction: number | null) => {
  if (fraction == null) return '—'
  const percent = fraction * 100
  const roundsToHundred = Number(percent.toFixed(1)) === 100
  const shown =
    roundsToHundred && percent > 100 ? 100.1 : roundsToHundred && percent < 100 ? 99.9 : percent
  return `${shown.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`
}

// rounding is what keeps 0,29 from surfacing as 28.999999999999996, a value the field could never
// match against the 29 it had just committed — leaving „Zapisz" armed forever.
export const ratePercent = (rate: number) => Math.round(rate * 10000) / 100

export const ratePercentText = (rate: number | null) =>
  ratePercent(rate ?? 0).toLocaleString('pl-PL')

export const planeViewSuffix = (plane: ToolPlaneT) =>
  ` w widoku ${PLANE_LABELS[plane].toLowerCase()}`

export const planeDashSuffix = (plane: ToolPlaneT) => ` — ${PLANE_LABELS[plane].toLowerCase()}`
