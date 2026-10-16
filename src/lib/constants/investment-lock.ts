import type { InvestmentStatusT } from '@/lib/constants/investment-status'

// the transfers gate is a COLLECTION HOOK, so it is pulled into the Payload CLI graph, where
// `server-only` throws under `payload generate:types`.
export const INVESTMENT_LOCKED_MESSAGE =
  'Inwestycja jest zakończona i tylko do odczytu. Aby ją zmienić, ustaw jej status na „Aktywna".'

export const INVESTMENT_TRASHED_MESSAGE = 'Inwestycja jest w koszu — przywróć ją, żeby coś zmienić.'

export const TEMPLATE_TRASHED_MESSAGE = 'Szablon jest w koszu — przywróć go, żeby coś zmienić.'

export const trashedMessageFor = (status: string | null | undefined): string =>
  status === TEMPLATE_INVESTMENT_STATUS ? TEMPLATE_TRASHED_MESSAGE : INVESTMENT_TRASHED_MESSAGE

export const LOCKED_INVESTMENT_STATUS = 'completed' satisfies InvestmentStatusT

export const isLockedStatus = (status: string | null | undefined): boolean =>
  status === LOCKED_INVESTMENT_STATUS

export type InvestmentLockT = 'completed' | 'trashed'

export const investmentLockOf = (investment: {
  status: string
  trashed: boolean
}): InvestmentLockT | undefined => {
  if (investment.trashed) return 'trashed'
  if (isLockedStatus(investment.status)) return 'completed'
  return undefined
}

export const TEMPLATE_INVESTMENT_STATUS = 'szablon' satisfies InvestmentStatusT

export const isBookableInvestment = (investment: { status: string }): boolean =>
  !isLockedStatus(investment.status)

// A status set, not the ref's `active` flag — widening that flag
// would leak Planowana into every other „aktywne” picker and count.
const OFFERED_FOR_BOOKING: Record<InvestmentStatusT, boolean> = {
  quote: false,
  planowana: true,
  active: true,
  completed: false,
  rejected: false,
  szablon: false,
}

export function isOfferedForBooking(investment: { status: InvestmentStatusT }): boolean {
  return OFFERED_FOR_BOOKING[investment.status]
}
