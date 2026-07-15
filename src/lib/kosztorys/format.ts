// Bare pl-PL number with 2 decimals (no currency symbol) for dense grid cells and subtotals —
// distinct from `formatPLN`, which emits "zł" and is too wide for the spreadsheet layout.
export const formatNet = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A fraction (0.746) as a percentage. `null` means there was no denominator to divide by, which
// renders as a dash rather than 0% — "not measurable" and "nothing done" are different answers.
// Two precisions: integer for the dense grid cells, one decimal for the headline figures where the
// whole kosztorys hangs on a single number.
const percentFormat = (fraction: number | null, fractionDigits: number) =>
  fraction == null
    ? '—'
    : `${(fraction * 100).toLocaleString('pl-PL', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })}%`

export const formatPercent = (fraction: number | null) => percentFormat(fraction, 0)

export const formatPercentPrecise = (fraction: number | null) => percentFormat(fraction, 1)
