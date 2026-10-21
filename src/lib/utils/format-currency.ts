import { roundToCents } from '@/lib/utils/round-to-cents'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export const formatPLN = (amount: number) => formatter.format(roundToCents(amount))

export const formatSignedPLN = (amount: number) =>
  roundToCents(amount) > 0 ? `+${formatPLN(amount)}` : formatPLN(amount)

export const formatPLNOrDash = (amount: number | null) =>
  amount === null ? EMPTY_VALUE : formatPLN(amount)
