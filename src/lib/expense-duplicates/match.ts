// SPIKE (EX-1025): duplicate matching between one paragon of a zgłoszenie and existing expenses.
// Rules and the evidence behind them: context/changes/2026-10-07-invoice-duplicate-detection/change.md.

export type ExpenseDocT = {
  amount: number | null
  // Line 1 of `invoiceNote` — where the AI scan writes the document number.
  invoiceNote: string | null
  // „Castorama 06.10.2026" — the AI scan's seller + the date printed on the document.
  description: string | null
  // Stand-in for a content hash: `filesize:widthxheight` per page.
  fingerprints: string[]
}

export type DuplicateReasonT = 'same-file' | 'same-number' | 'same-receipt' | 'same-amount'
export type DuplicateTierT = 'strong' | 'weak'

export type DuplicateVerdictT = {
  tier: DuplicateTierT
  reasons: DuplicateReasonT[]
  sharedItems: number
  totalItems: number
}

const WEAK_WINDOW_DAYS = 3
const RECEIPT_DATE = /(\d{2})\.(\d{2})\.(\d{4})/

const cents = (amount: number | null) => (amount === null ? null : Math.round(amount * 100))

const lines = (note: string | null) =>
  (note ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

// A loyalty-card number or a date also sits on line 1 now and then, which is why a number only
// counts next to an equal amount.
export function documentNumber(note: string | null): string | null {
  const first = lines(note)[0]
  if (!first) return null
  const normalized = first.toUpperCase().replace(/\s+/g, '')
  if (normalized.length < 5 || !/\d/.test(normalized)) return null
  return normalized
}

const itemKeys = (note: string | null) =>
  new Set(
    lines(note)
      .slice(1)
      .map((line) => line.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean),
  )

function receiptDay(description: string | null): number | null {
  const match = description?.match(RECEIPT_DATE)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)) / 86_400_000
}

// „Leroy Merlin" and „Leroy-Merlin Polska" must agree, so the key is a short alphanumeric prefix.
function sellerKey(description: string | null): string | null {
  const name = description
    ?.replace(RECEIPT_DATE, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
  return name && name.length >= 3 ? name.slice(0, 5) : null
}

export function matchExpense(probe: ExpenseDocT, candidate: ExpenseDocT): DuplicateVerdictT | null {
  const probeCents = cents(probe.amount)
  const isSameAmount = probeCents !== null && probeCents === cents(candidate.amount)
  // Without a read amount the identifiers have nothing to be checked against, so they count alone.
  const doesAmountAgree = isSameAmount || probeCents === null

  const reasons: DuplicateReasonT[] = []

  // Same photo + different amount is one invoice split across investments, not a duplicate.
  if (doesAmountAgree && probe.fingerprints.some((fp) => candidate.fingerprints.includes(fp))) {
    reasons.push('same-file')
  }

  const number = documentNumber(probe.invoiceNote)
  if (doesAmountAgree && number !== null && number === documentNumber(candidate.invoiceNote)) {
    reasons.push('same-number')
  }

  // The AI reads a different number off the same paragon now and then; amount + printed date +
  // seller is what still catches it.
  const probeDay = receiptDay(probe.description)
  const candidateDay = receiptDay(candidate.description)
  const probeSeller = sellerKey(probe.description)
  if (
    isSameAmount &&
    probeDay !== null &&
    probeDay === candidateDay &&
    probeSeller !== null &&
    probeSeller === sellerKey(candidate.description)
  ) {
    reasons.push('same-receipt')
  }

  const probeItems = itemKeys(probe.invoiceNote)
  const candidateItems = itemKeys(candidate.invoiceNote)
  const sharedItems = [...probeItems].filter((item) => candidateItems.has(item)).length
  const totalItems = Math.max(probeItems.size, candidateItems.size)

  if (reasons.length > 0) return { tier: 'strong', reasons, sharedItems, totalItems }

  // Keyed on the printed date, not the booking date: equal amounts within ±3 booking days are
  // hundreds of pairs, within ±3 printed days a handful.
  if (
    isSameAmount &&
    probeDay !== null &&
    candidateDay !== null &&
    Math.abs(probeDay - candidateDay) <= WEAK_WINDOW_DAYS
  ) {
    return { tier: 'weak', reasons: ['same-amount'], sharedItems, totalItems }
  }
  return null
}
