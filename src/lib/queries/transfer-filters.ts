import type { Where } from 'payload'
import type { ResolvedSearchParamsT } from '@/types/page'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'

type UserContextT = {
  id: number
  onlyOwnTransfers?: boolean
}

function getStringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Ids reach raw SQL by interpolation (`where-to-sql.ts`), so anything `Number` accepts but Postgres
 * does not has to die here. `Number.isInteger` rather than a truthiness check: `?worker=1e999`
 * parses to `Infinity`, which is truthy and lands in the statement as a bare `infinity` identifier.
 */
function parseNumericIds(param: string | undefined): number[] {
  if (!param) return []
  return param
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id !== 0)
}

type AmountSearchT = { mode: 'prefix'; text: string } | { mode: 'range'; low: number; high: number }

/**
 * Parse an amount search term into one of two match modes (EX-408).
 *
 * The decimal separator is the mode switch:
 *   • NO separator → textual PREFIX on `amount::text` ("18" → 18, 189, 18000…),
 *     resolved downstream via raw SQL LIKE.
 *   • separator present → numeric half-open RANGE [v, v + 10⁻ᵈ) where d = the count
 *     of fractional digits typed. "18,00" → [18, 18.01) pins to a clean 18; "18,1"
 *     → [18.1, 18.2) spans 18.10–18.19. Comparing by numeric VALUE (not text) is
 *     why this beats the old prefix-LIKE: a stored 18.00 renders as "18", so no
 *     text prefix of "18.00" could ever match it.
 *
 * The `numeric` column has max scale 2, so a 2-decimal term degrades to an exact
 * match on its own — the range just happens to contain a single storable value.
 * Boundaries are built in integer space and re-parsed via toFixed so they equal the
 * canonical decimal double, keeping the exclusive `high` edge drift-free.
 *
 * Returns null for non-numeric input (filter skipped).
 */
function normalizeAmountSearch(raw: string | undefined): AmountSearchT | null {
  if (!raw) return null
  const dotted = raw.replace(',', '.')
  if (!/^\d+([.,]\d*)?$/.test(raw)) return null

  const hasSeparator = raw.includes(',') || raw.includes('.')
  if (!hasSeparator) return { mode: 'prefix', text: raw }

  const [intPart, fracPart = ''] = dotted.split('.')
  const decimals = fracPart.length
  const factor = 10 ** decimals
  const scaledLow = Number(intPart + fracPart)
  if (!Number.isFinite(scaledLow)) return null

  const low = Number((scaledLow / factor).toFixed(decimals))
  const high = Number(((scaledLow + 1) / factor).toFixed(decimals))
  return { mode: 'range', low, high }
}

export function buildTransferFilters(
  searchParams: ResolvedSearchParamsT,
  userContext: UserContextT,
): Where {
  // Impossible condition — forces Payload to return zero results
  const NO_RESULTS = { equals: -1 } as const
  const where: Where = {}

  // Manager scoped to own transactions (dashboard only)
  if (userContext.onlyOwnTransfers) {
    where.createdBy = { equals: userContext.id }
  }

  // Audit mode — show only CANCELLATION rows for the period; originals are merged in by the caller
  const cancelledTransactionAudit = getStringParam(searchParams.cancelledTransactionAudit) === '1'

  // Hide cancelled transfers by default (cancelled originals + CANCELLATION type)
  const showCancelled =
    getStringParam(searchParams.showCancelled) === '1' || cancelledTransactionAudit

  if (cancelledTransactionAudit) {
    where.type = { in: ['CANCELLATION'] }
  } else {
    // Type filter (supports comma-separated multi-select)
    const typeParam = getStringParam(searchParams.type)
    if (typeParam) {
      let types = typeParam
        .split(',')
        .filter((t) => (TRANSFER_TYPES as readonly string[]).includes(t))
      if (!showCancelled) types = types.filter((t) => t !== 'CANCELLATION')
      if (types.length > 0) where.type = { in: types }
      else where.id = NO_RESULTS // No valid types → return no results
    } else if (!showCancelled) {
      where.type = { not_in: ['CANCELLATION'] }
    }
  }

  if (!showCancelled) {
    where.cancelled = { not_equals: true }
  }

  // Cash register filter — matches source OR target register
  const sourceRegisterParam = getStringParam(searchParams.sourceRegister)
  const sourceRegisterIds = parseNumericIds(sourceRegisterParam)
  if (sourceRegisterIds.length > 0) {
    where.or = [
      { sourceRegister: { in: sourceRegisterIds } },
      { targetRegister: { in: sourceRegisterIds } },
    ]
  } else if (sourceRegisterParam) where.id = NO_RESULTS

  // Investment filter (supports comma-separated multi-select)
  const investmentParam = getStringParam(searchParams.investment)
  const investmentIds = parseNumericIds(investmentParam)
  if (investmentIds.length > 0) where.investment = { in: investmentIds }
  else if (investmentParam) where.id = NO_RESULTS

  // Created by filter — skip when onlyOwnTransfers is active (security: don't override role scope)
  if (!userContext.onlyOwnTransfers) {
    const createdByParam = getStringParam(searchParams.createdBy)
    const createdByIds = parseNumericIds(createdByParam)
    if (createdByIds.length > 0) where.createdBy = { in: createdByIds }
    else if (createdByParam) where.id = NO_RESULTS
  }

  // Payment method filter (validates against known methods)
  const paymentMethodParam = getStringParam(searchParams.paymentMethod)
  if (paymentMethodParam) {
    const methods = paymentMethodParam
      .split(',')
      .filter((m) => (PAYMENT_METHODS as readonly string[]).includes(m))
    if (methods.length > 0) where.paymentMethod = { in: methods }
    else where.id = NO_RESULTS
  }

  // Expense category filter (investment expense type)
  const expenseCategoryParam = getStringParam(searchParams.expenseCategory)
  const expenseCategoryIds = parseNumericIds(expenseCategoryParam)
  if (expenseCategoryIds.length > 0) where.expenseCategory = { in: expenseCategoryIds }
  else if (expenseCategoryParam) where.id = NO_RESULTS

  // Worker filter. `in` rather than `equals` so the multi-select and the subcontractor summary's
  // per-worker link (`?type=PAYOUT&worker=<id>`) share one parameter — a single id parses as a
  // one-element list, so the link keeps working.
  const workerParam = getStringParam(searchParams.worker)
  const workerIds = parseNumericIds(workerParam)
  if (workerIds.length > 0) where.worker = { in: workerIds }
  else if (workerParam) where.id = NO_RESULTS

  // Other category filter
  const otherCategoryParam = getStringParam(searchParams.otherCategory)
  const otherCategoryIds = parseNumericIds(otherCategoryParam)
  if (otherCategoryIds.length > 0) where.otherCategory = { in: otherCategoryIds }
  else if (otherCategoryParam) where.id = NO_RESULTS

  // Amount search — prefix LIKE (raw SQL downstream) or a numeric range (native Payload)
  const amountSearch = normalizeAmountSearch(getStringParam(searchParams.amount))
  if (amountSearch) {
    where.amount =
      amountSearch.mode === 'prefix'
        ? { like: amountSearch.text }
        : { greater_than_equal: amountSearch.low, less_than: amountSearch.high }
  }

  // ID search — exact match. Defers to NO_RESULTS if another filter already short-circuited.
  const idParam = getStringParam(searchParams.id)
  if (idParam && /^\d+$/.test(idParam) && !where.id) {
    where.id = { equals: Number(idParam) }
  }

  // Date range
  const fromParam = getStringParam(searchParams.from)
  const toParam = getStringParam(searchParams.to)
  if (fromParam || toParam) {
    where.date = {}
    if (fromParam) (where.date as Record<string, string>).greater_than_equal = fromParam
    if (toParam) (where.date as Record<string, string>).less_than_equal = toParam
  }

  return where
}

// The fields a CANCELLATION row does not carry. cancelTransferAction copies only amount, date,
// description and the back-reference — deliberately, since a persisted sourceRegister
// would be subtracted a second time by the balance query (see enrichCancellationOriginals). So every
// screen that narrows by one of these — kasa, pracownik, inwestycja — cut the audit rows away before
// they could be paired with anything, and „Tryb anulowań" answered „Brak danych" on all three.
// Exported, so a composed Where can carry original-only fields under a branch — unwalked, the list
// reads „Brak danych".
const isBranch = (field: string, condition: unknown): condition is Where[] =>
  (field === 'or' || field === 'and') && Array.isArray(condition)

export const FIELDS_ONLY_THE_ORIGINAL_CARRIES = [
  'sourceRegister',
  'targetRegister',
  'investment',
  'worker',
  'expenseCategory',
  'otherCategory',
  // Joined the list when the method stopped being copied onto the audit row: an anulowanie is never
  // asked how it was paid, so „anulowania przelewem" can only mean the original's method.
  'paymentMethod',
] as const

/**
 * Re-aim the audit list's scope at the transaction being cancelled.
 *
 * „Tryb anulowań" lists CANCELLATION rows and pairs each with its original. The narrowing, though,
 * is always about the original — „anulowania w tej kasie" means transactions of that kasa that were
 * cancelled, and the audit row itself belongs to no kasa at all. Payload resolves the dotted path
 * through the self-relation, so this stays one query rather than a prefetch of ids.
 *
 * The list only. The sum tile above it goes through where-to-sql, which knows columns of
 * `transactions` and throws on anything else — and a CANCELLATION copies its original's amount, so
 * the tile is summing the same money either way.
 *
 * Fields the audit row DOES carry stay put and mean what they say: `date` is when it was cancelled,
 * `createdBy` is who cancelled it.
 */
export function scopeAuditThroughOriginal(where: Where): Where {
  return Object.fromEntries(
    Object.entries(where).map(([field, condition]) => {
      if (isBranch(field, condition)) return [field, condition.map(scopeAuditThroughOriginal)]
      return (FIELDS_ONLY_THE_ORIGINAL_CARRIES as readonly string[]).includes(field)
        ? [`cancelledTransaction.${field}`, condition]
        : [field, condition]
    }),
  )
}

/**
 * Whether a scope narrows by something only the ORIGINAL carries — i.e. whether the sum tile can
 * still be trusted in „Tryb anulowań". The tile goes through where-to-sql, which throws on a dotted
 * path, so it cannot be re-aimed the way the list is — the caller drops it rather than render a
 * confident 0,00 zł beside a populated list.
 */
export function scopeNarrowsByOriginalOnlyField(where: Where): boolean {
  return Object.entries(where).some(([field, condition]) => {
    if (isBranch(field, condition)) return condition.some(scopeNarrowsByOriginalOnlyField)
    return (FIELDS_ONLY_THE_ORIGINAL_CARRIES as readonly string[]).includes(field)
  })
}

/**
 * Drop the `cancelled` condition for stats queries, which hardcode `cancelled IS NOT TRUE` in SQL.
 *
 * The `type` condition must survive: a CANCELLATION row copies its original's amount and carries
 * `cancelled = false`, so the default `not_in: ['CANCELLATION']` is the only thing keeping it out
 * of the sum (EX-574).
 */
export function stripCancelledFilters(where: Where): Where {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cancelled, ...rest } = where
  return rest
}
