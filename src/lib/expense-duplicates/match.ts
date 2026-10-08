// Duplicate matching between one paragon of a zgłoszenie and existing expenses (EX-1025).
// The evidence behind each rule: context/changes/2026-10-07-invoice-duplicate-detection/change.md.

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
export type MatchTierT = 'strong' | 'weak'

export type MatchVerdictT = {
  tier: MatchTierT
  reasons: MatchReasonT[]
}

const WEAK_WINDOW_DAYS = 3
const DAY_MS = 86_400_000
const PRINTED_DATE = /(\d{2})\.(\d{2})\.(\d{4})/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const cents = (amount: number | null) => (amount === null ? null : Math.round(amount * 100))

/**
 * Uppercased, whitespace stripped. A loyalty-card number or a date sits on „Notatka" line 1 now and
 * then, which is why a number only counts next to an agreeing amount — and why it needs a digit and
 * five characters to count at all.
 */
function normalizeDocumentNumber(raw: string | null | undefined): string | null {
  const normalized = raw?.toUpperCase().replace(/\s+/g, '') ?? ''
  return normalized.length >= 5 && /\d/.test(normalized) ? normalized : null
}

const firstLine = (note: string | null) =>
  (note ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? null

/** The column, else „Notatka" line 1 on a row booked before it existed. */
export const documentNumberOf = (doc: ExpenseDocT) =>
  normalizeDocumentNumber(doc.documentNumber) ?? normalizeDocumentNumber(firstLine(doc.invoiceNote))

function dayOf(doc: ExpenseDocT): number | null {
  const iso = doc.documentDate?.match(ISO_DATE)
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) / DAY_MS
  const printed = doc.description?.match(PRINTED_DATE)
  if (!printed) return null
  return Date.UTC(Number(printed[3]), Number(printed[2]) - 1, Number(printed[1])) / DAY_MS
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

export function matchExpense(probe: ExpenseDocT, candidate: ExpenseDocT): MatchVerdictT | null {
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

  if (reasons.length > 0) return { tier: 'strong', reasons }

  // Keyed on the printed date, not the booking date: equal amounts within ±3 booking days are
  // hundreds of pairs, within ±3 printed days a handful.
  if (
    isSameAmount &&
    probeDay !== null &&
    candidateDay !== null &&
    Math.abs(probeDay - candidateDay) <= WEAK_WINDOW_DAYS
  ) {
    return { tier: 'weak', reasons: ['same-amount'] }
  }
  return null
}
