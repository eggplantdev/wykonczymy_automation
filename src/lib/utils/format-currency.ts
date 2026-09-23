import { roundToCents } from '@/lib/utils/round-to-cents'

const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

// `+ 0` after rounding collapses JS's negative zero: a bilans is a negated figure, so a settlement
// that cancels out arrives here as -0 (or as a −7e-12 residue that rounds to it) and Intl keeps the
// sign, printing „-0,00 zł" for an investment that owes nothing.
export const formatPLN = (amount: number) => formatter.format(roundToCents(amount))

/** For a figure that may be unknown: „—" rather than „0,00 zł", which would read as „it was free". */
export const formatPLNOrDash = (amount: number | null) =>
  amount === null ? '—' : formatPLN(amount)
