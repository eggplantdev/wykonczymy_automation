'use client'

import { usePathname } from 'next/navigation'
import type { InvestmentRefT } from '@/types/reference-data'
import { isOfferedForBooking } from '@/lib/constants/investment-status'

// `[id]` is also /kasa/[id] and /pracownicy/[id], so useParams alone would hand a cash-register or
// worker id to the investment select — the path prefix is what makes the segment mean "investment".
const INVESTMENT_PATH = /^\/inwestycje\/(\d+)(\/|$)/

/**
 * The investment id the current URL is scoped to, as the form's string value ('' when there is
 * none). Validated against `investments` because that list is role-filtered — an id the user can't
 * pick must not be seeded into the form. Seeding SKIPS the picker, so it has to repeat the picker's
 * status set: the picker keeps whatever the field already holds, so „Dodaj wydatek" from a Wycena's
 * page would otherwise book against an investment the picker never offers.
 */
export function useInvestmentFromUrl(investments: readonly InvestmentRefT[]): string {
  const pathname = usePathname()
  const id = pathname?.match(INVESTMENT_PATH)?.[1]
  if (!id) return ''
  return investments.some(
    (investment) => investment.id === Number(id) && isOfferedForBooking(investment),
  )
    ? id
    : ''
}
