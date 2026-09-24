import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { PriceSourceT } from '@/lib/kosztorys/types'

// Bare pl-PL number with 2 decimals (no currency symbol) for dense grid cells and subtotals —
// distinct from `formatPLN`, which emits "zł" and is too wide for the spreadsheet layout.
// Through `roundToCents` for its negative-zero collapse: a deduction row negates its amount, so no
// wpłaty reached toLocaleString as -0, and a settlement that cancels out lands on -7e-12 rather than
// on 0 — toLocaleString rounds that to „0,00" but keeps the sign, printing „-0,00".
export const formatNet = (n: number) =>
  roundToCents(n).toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

// A quantity as prose, not as a grid figure: no fixed decimals, because „95" reads as the whole
// number the owner typed while `formatNet` would render it „95,00" and invite the reader to look for
// a precision that isn't there.
export const formatQty = (n: number) =>
  (n + 0).toLocaleString('pl-PL', { maximumFractionDigits: 3 })

// A mnożnik as prose, to as many places as one is stored in (`round6`). Through `formatQty` above a
// derived 0,5525 showed as „0,553" — a number the import then did not adopt, and the reader's only
// preview of what the cennik decided.
export const formatCoeff = (n: number) =>
  (n + 0).toLocaleString('pl-PL', { maximumFractionDigits: 6 })

/**
 * A stawka wykonawcy as its ŹRÓDŁO names it, wherever one is printed as prose rather than edited:
 * „auto", a kwota, or „×0,8" — the mnożnik itself, not the złotówka it produces, because the mnożnik
 * is what was agreed and the złotówka moves with the cena j.m. (EX-865). Where a kwota is known it
 * follows in brackets; a katalog wpis outside any inwestycja has none.
 */
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

// A fraction (0.746) as a percentage; `null` (no denominator — see rowDoneFraction) renders as a
// dash. Two precisions: integer for the dense grid cells, one decimal for the headline figures where
// the whole kosztorys hangs on a single number.
const percentFormat = (fraction: number | null, fractionDigits: number) =>
  fraction == null
    ? '—'
    : `${(fraction * 100).toLocaleString('pl-PL', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })}%`

export const formatPercent = (fraction: number | null) => percentFormat(fraction, 0)

export const formatPercentPrecise = (fraction: number | null) => percentFormat(fraction, 1)

// A stored VAT/materiały rate (0,075) as the percent a rate FIELD shows and re-commits. Distinct from
// `formatPercent` above, which renders a progress fraction as display text — this one has to survive
// a round trip through the input, so it stays a number and rounds to two decimals rather than to a
// whole one. `Math.round(rate * 100)` showed a saved 7,5% as 8% and then PERSISTED the 8 on the next
// „Zapisz"; the same rounding is what keeps 0,29 from surfacing as 28.999999999999996, a value the
// field could never match against the 29 it had just committed — leaving „Zapisz" armed forever.
export const ratePercent = (rate: number) => Math.round(rate * 10000) / 100

// The same figure as pl-PL prose without a „%" — the callers print their own, some inside a formula.
export const ratePercentText = (rate: number | null) =>
  ratePercent(rate ?? 0).toLocaleString('pl-PL')
