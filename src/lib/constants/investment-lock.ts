import type { InvestmentStatusT } from '@/lib/constants/investment-status'

// Its own module rather than a constant on `investment-action.ts`, which is `server-only`: the
// transfers gate is a COLLECTION HOOK, so it is pulled into the Payload CLI graph, where
// `server-only` throws under `payload generate:types`. Both planes refuse in the same sentence.
export const INVESTMENT_LOCKED_MESSAGE =
  'Inwestycja jest zakończona i tylko do odczytu. Aby ją zmienić, ustaw jej status na „Aktywna".'

export const INVESTMENT_TRASHED_MESSAGE = 'Inwestycja jest w koszu — przywróć ją, żeby coś zmienić.'

/**
 * „Zakończona" IS the status lock — the one comparison, spelled once; the trash is the gate's other,
 * non-status reason. Six layers ask it (the panel's access rules, both gates, the editor page, the
 * form's confirmation), so a second locking status would otherwise mean finding six literals.
 */
export const LOCKED_INVESTMENT_STATUS = 'completed' satisfies InvestmentStatusT

export const isLockedStatus = (status: string | null | undefined): boolean =>
  status === LOCKED_INVESTMENT_STATUS

export const COMPLETE_INVESTMENT_CONFIRM = {
  title: 'Zakończyć inwestycję?',
  description:
    'Zakończona inwestycja jest tylko do odczytu — nikt nie dopisze transakcji ani nie zmieni kosztorysu. Odblokować może ją wyłącznie właściciel lub administrator, ustawiając status z powrotem na „Aktywna".',
  confirmLabel: 'Zakończ',
}

export type InvestmentLockT = 'completed' | 'trashed'

export const investmentLockOf = (investment: {
  status: string
  trashed: boolean
}): InvestmentLockT | undefined => {
  if (investment.trashed) return 'trashed'
  if (isLockedStatus(investment.status)) return 'completed'
  return undefined
}

/**
 * What the server accepts a booking on (the real gate is the collection hook) — the transfers table
 * reads it for edit / cancel. Booking pickers offer a narrower set, `isOfferedForBooking`; widening
 * one into the other silently re-offers Wycena or locks its transfers.
 */
export const isBookableInvestment = (investment: { status: string }): boolean =>
  !isLockedStatus(investment.status)

// Owner rulings: Planowana stays (money is booked on planned work, 2026-10-15); Wycena is out pending
// the owner's decision (EX-1066). A status set, not the ref's `active` flag — widening that flag
// would leak Planowana into every other „aktywne” picker and count. The server still refuses only
// Zakończona; this only decides what a booking form offers.
const OFFERED_FOR_BOOKING: Record<InvestmentStatusT, boolean> = {
  quote: false,
  planowana: true,
  active: true,
  completed: false,
  rejected: false,
}

export function isOfferedForBooking(investment: { status: InvestmentStatusT }): boolean {
  return OFFERED_FOR_BOOKING[investment.status]
}
