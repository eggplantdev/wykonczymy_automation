import { roundToCents } from '@/lib/utils/round-to-cents'

const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export const formatPLN = (amount: number) => formatter.format(roundToCents(amount))

export const formatPLNOrDash = (amount: number | null) =>
  amount === null ? '—' : formatPLN(amount)
