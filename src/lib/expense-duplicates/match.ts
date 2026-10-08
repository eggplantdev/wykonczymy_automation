import { addMonthsToDay, toWarsawDay, type DayT } from '@/lib/utils/days'
import { firstNoteLine } from '@/lib/utils/invoice-note'

export type ExpenseDocT = {
  amount: number | null
  documentNumber: string | null
  sellerNip: string | null
  // ISO `YYYY-MM-DD`, the date printed on the document.
  documentDate: string | null
  // Rows booked before the identity columns carry the number on line 1 of „Notatka"
  // and the seller + printed date in „Opis" („Castorama 06.10.2026") — the fallback reads those.
  invoiceNote: string | null
  description: string | null
}

export type MatchReasonT = 'same-number' | 'same-receipt' | 'same-amount'

export type MatchVerdictT = {
  reasons: MatchReasonT[]
}

export const isWeakMatch = (reasons: MatchReasonT[]) =>
  reasons.every((reason) => reason === 'same-amount')

// The booking (or sending) moment, needed only for the same-amount window.
type DatedDocT = ExpenseDocT & { date?: string }

const SAME_AMOUNT_WINDOW_MONTHS = 3

const PRINTED_DATE = /(\d{2})\.(\d{2})\.(\d{4})/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const cents = (amount: number | null) => (amount === null ? null : Math.round(amount * 100))

/**
 * Uppercased, whitespace stripped. A loyalty-card number or a date sits on „Notatka" line 1 now and
 * then, which is why a number only counts next to an agreeing amount — and why it needs a digit and
 * five characters to count at all.
 */
function normalizeDocumentNumber(raw: string | null | undefined): string | null {
  const normalized = raw?.toUpperCase().replace(/\s+/g, '') ?? ''
  return normalized.length >= 5 && /\d/.test(normalized) ? normalized : null
}

/** The column, else „Notatka" line 1 on a row booked before it existed. */
export const documentNumberOf = (doc: ExpenseDocT) =>
  normalizeDocumentNumber(doc.documentNumber) ??
  normalizeDocumentNumber(firstNoteLine(doc.invoiceNote))

function dayOf(doc: ExpenseDocT): DayT | null {
  if (doc.documentDate && ISO_DATE.test(doc.documentDate)) return doc.documentDate
  const printed = doc.description?.match(PRINTED_DATE)
  return printed ? `${printed[3]}-${printed[2]}-${printed[1]}` : null
}

// „Leroy Merlin" and „Leroy-Merlin Polska" must agree, so the key is a short alphanumeric prefix.
function namePrefix(description: string | null): string | null {
  const name = description
    ?.replace(PRINTED_DATE, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
  return name && name.length >= 3 ? name.slice(0, 5) : null
}

function isSameSeller(probe: ExpenseDocT, candidate: ExpenseDocT): boolean {
  if (probe.sellerNip && candidate.sellerNip) return probe.sellerNip === candidate.sellerNip
  const prefix = namePrefix(probe.description)
  return prefix !== null && prefix === namePrefix(candidate.description)
}

const hasConflictingNips = (probe: ExpenseDocT, candidate: ExpenseDocT) =>
  !!probe.sellerNip && !!candidate.sellerNip && probe.sellerNip !== candidate.sellerNip

const differ = <T>(a: T | null, b: T | null) => a !== null && b !== null && a !== b

function isProvablyDifferent(probe: ExpenseDocT, candidate: ExpenseDocT): boolean {
  const isOtherSeller =
    probe.sellerNip && candidate.sellerNip
      ? probe.sellerNip !== candidate.sellerNip
      : differ(namePrefix(probe.description), namePrefix(candidate.description))
  return (
    isOtherSeller ||
    differ(documentNumberOf(probe), documentNumberOf(candidate)) ||
    differ(dayOf(probe), dayOf(candidate))
  )
}

export function matchExpense(
  probe: ExpenseDocT,
  candidate: DatedDocT,
  today: DayT,
): MatchVerdictT | null {
  const probeCents = cents(probe.amount)
  const isSameAmount = probeCents !== null && probeCents === cents(candidate.amount)
  // Without a read amount the number has nothing to be checked against, so it counts alone.
  const doesAmountAgree = isSameAmount || probeCents === null

  const reasons: MatchReasonT[] = []

  // Two sellers number their documents independently; a clash between them is a coincidence.
  const number = documentNumberOf(probe)
  if (
    doesAmountAgree &&
    number !== null &&
    number === documentNumberOf(candidate) &&
    !hasConflictingNips(probe, candidate)
  ) {
    reasons.push('same-number')
  }

  // The AI reads a different number off the same paragon now and then; amount + printed date +
  // seller is what still catches it.
  const probeDay = dayOf(probe)
  const candidateDay = dayOf(candidate)
  if (
    isSameAmount &&
    probeDay !== null &&
    probeDay === candidateDay &&
    isSameSeller(probe, candidate)
  ) {
    reasons.push('same-receipt')
  }

  if (reasons.length > 0) return { reasons }
  if (!isSameAmount || !candidate.date) return null

  // Mostly a row booked before the identity columns, with nothing read that could clear it. A
  // different printed day, seller or number is a second purchase of the same thing.
  const isRecent = toWarsawDay(candidate.date) >= addMonthsToDay(today, -SAME_AMOUNT_WINDOW_MONTHS)
  return isRecent && !isProvablyDifferent(probe, candidate) ? { reasons: ['same-amount'] } : null
}
