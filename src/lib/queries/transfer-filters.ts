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
 * The decimal separator is the mode switch (EX-408):
 *   • none → textual PREFIX on `amount::text` ("18" → 18, 189, 18000…), a raw SQL LIKE downstream.
 *   • present → numeric half-open RANGE [v, v + 10⁻ᵈ), d = fractional digits typed. "18,1" spans
 *     18.10–18.19. Matching by VALUE is the point: a stored 18.00 renders as "18", so no text
 *     prefix of "18,00" could match it.
 *
 * Boundaries are built in integer space and re-parsed via toFixed, so the exclusive `high` edge
 * equals the canonical decimal double. Null for non-numeric input (filter skipped).
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
  const NO_RESULTS = { equals: -1 } as const
  const where: Where = {}

  if (userContext.onlyOwnTransfers) {
    where.createdBy = { equals: userContext.id }
  }

  // Lists CANCELLATION rows only; the originals are merged in by the caller.
  const cancelledTransactionAudit = getStringParam(searchParams.cancelledTransactionAudit) === '1'

  const showCancelled =
    getStringParam(searchParams.showCancelled) === '1' || cancelledTransactionAudit

  // `null` = the param is absent, `[]` = it named nothing valid — including the multi-select's
  // „nothing selected" sentinel, which must empty the list rather than fall through to „all".
  const typeParam = getStringParam(searchParams.type)
  const requestedTypes = typeParam
    ? typeParam.split(',').filter((t) => (TRANSFER_TYPES as readonly string[]).includes(t))
    : null

  if (cancelledTransactionAudit) {
    where.type = { in: ['CANCELLATION'] }
    // Typ means the type of the transaction that WAS cancelled: every row here is a CANCELLATION,
    // so a scope on the row itself could only say „all" or „none". Dotted like the other
    // original-only scopes, so the sum tile drops (scopeNarrowsByOriginalOnlyField).
    if (requestedTypes) {
      if (requestedTypes.length > 0) where['cancelledTransaction.type'] = { in: requestedTypes }
      else where.id = NO_RESULTS
    }
  } else if (requestedTypes) {
    const types = showCancelled
      ? requestedTypes
      : requestedTypes.filter((t) => t !== 'CANCELLATION')
    if (types.length > 0) where.type = { in: types }
    else where.id = NO_RESULTS
  } else if (!showCancelled) {
    where.type = { not_in: ['CANCELLATION'] }
  }

  if (!showCancelled) {
    where.cancelled = { not_equals: true }
  }

  const sourceRegisterParam = getStringParam(searchParams.sourceRegister)
  const sourceRegisterIds = parseNumericIds(sourceRegisterParam)
  if (sourceRegisterIds.length > 0) {
    where.or = [
      { sourceRegister: { in: sourceRegisterIds } },
      { targetRegister: { in: sourceRegisterIds } },
    ]
  } else if (sourceRegisterParam) where.id = NO_RESULTS

  const investmentParam = getStringParam(searchParams.investment)
  const investmentIds = parseNumericIds(investmentParam)
  if (investmentIds.length > 0) where.investment = { in: investmentIds }
  else if (investmentParam) where.id = NO_RESULTS

  // Skipped while onlyOwnTransfers is active — the param must not widen the role scope.
  if (!userContext.onlyOwnTransfers) {
    const createdByParam = getStringParam(searchParams.createdBy)
    const createdByIds = parseNumericIds(createdByParam)
    if (createdByIds.length > 0) where.createdBy = { in: createdByIds }
    else if (createdByParam) where.id = NO_RESULTS
  }

  const paymentMethodParam = getStringParam(searchParams.paymentMethod)
  if (paymentMethodParam) {
    const methods = paymentMethodParam
      .split(',')
      .filter((m) => (PAYMENT_METHODS as readonly string[]).includes(m))
    if (methods.length > 0) where.paymentMethod = { in: methods }
    else where.id = NO_RESULTS
  }

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

  const otherCategoryParam = getStringParam(searchParams.otherCategory)
  const otherCategoryIds = parseNumericIds(otherCategoryParam)
  if (otherCategoryIds.length > 0) where.otherCategory = { in: otherCategoryIds }
  else if (otherCategoryParam) where.id = NO_RESULTS

  const amountSearch = normalizeAmountSearch(getStringParam(searchParams.amount))
  if (amountSearch) {
    where.amount =
      amountSearch.mode === 'prefix'
        ? { like: amountSearch.text }
        : { greater_than_equal: amountSearch.low, less_than: amountSearch.high }
  }

  // Defers to NO_RESULTS if another filter already short-circuited.
  const idParam = getStringParam(searchParams.id)
  if (idParam && /^\d+$/.test(idParam) && !where.id) {
    where.id = { equals: Number(idParam) }
  }

  const fromParam = getStringParam(searchParams.from)
  const toParam = getStringParam(searchParams.to)
  if (fromParam || toParam) {
    where.date = {}
    if (fromParam) (where.date as Record<string, string>).greater_than_equal = fromParam
    if (toParam) (where.date as Record<string, string>).less_than_equal = toParam
  }

  return where
}

// The fields a CANCELLATION row does not carry: cancelTransferAction copies only amount, date,
// description and the back-reference, since a persisted sourceRegister would be subtracted a second
// time by the balance query (see enrichCancellationOriginals). Narrowing by one of them cuts the
// audit rows away before they can be paired with anything, so „Tryb anulowań" reads „Brak danych".
const ORIGINAL_PATH_PREFIX = 'cancelledTransaction.'

type WhereLeafT = Where[string]

const isBranch = (field: string, condition: WhereLeafT): condition is Where[] =>
  (field === 'or' || field === 'and') && Array.isArray(condition)

/**
 * Rewrite a `Where` tree's LEAVES, recursing through `or` / `and` — which is where these filters
 * actually get written. Returning `undefined` drops the leaf.
 */
function mapWhereLeaves(
  where: Where,
  rewrite: (field: string, condition: WhereLeafT) => [string, WhereLeafT] | undefined,
): Where {
  return Object.fromEntries(
    Object.entries(where).flatMap(([field, condition]) => {
      if (isBranch(field, condition))
        return [[field, condition.map((branch) => mapWhereLeaves(branch, rewrite))]]
      const next = rewrite(field, condition)
      return next ? [next] : []
    }),
  )
}

/** The `.some()` half of `mapWhereLeaves` — same branch walk, asking instead of rewriting. */
function someWhereLeaf(where: Where, predicate: (field: string) => boolean): boolean {
  return Object.entries(where).some(([field, condition]) =>
    isBranch(field, condition)
      ? condition.some((branch) => someWhereLeaf(branch, predicate))
      : predicate(field),
  )
}

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
 * Re-aim the audit list's scope at the transaction being cancelled: „anulowania w tej kasie" means
 * transactions of that kasa that were cancelled, and the audit row belongs to no kasa at all.
 * Payload resolves the dotted path through the self-relation, so this stays one query.
 *
 * The list only — the sum tile goes through where-to-sql, which throws on anything but a column of
 * `transactions`, and a CANCELLATION copies its original's amount, so the tile sums the same money.
 * Fields the audit row DOES carry stay put: `date` is when it was cancelled, `createdBy` who by.
 */
export function scopeAuditThroughOriginal(where: Where): Where {
  return mapWhereLeaves(where, (field, condition) =>
    (FIELDS_ONLY_THE_ORIGINAL_CARRIES as readonly string[]).includes(field)
      ? [`${ORIGINAL_PATH_PREFIX}${field}`, condition]
      : [field, condition],
  )
}

/**
 * Whether a scope narrows by something only the ORIGINAL carries — i.e. whether the sum tile can
 * still be trusted in „Tryb anulowań". The tile goes through where-to-sql, which throws on a dotted
 * path, so it cannot be re-aimed the way the list is — the caller drops it rather than render a
 * confident 0,00 zł beside a populated list.
 */
export function scopeNarrowsByOriginalOnlyField(where: Where): boolean {
  return someWhereLeaf(
    where,
    (field) =>
      (FIELDS_ONLY_THE_ORIGINAL_CARRIES as readonly string[]).includes(field) ||
      field.startsWith(ORIGINAL_PATH_PREFIX),
  )
}

/**
 * Drop the scopes that reach through the cancelled original. A page that feeds its own tiles from
 * the same Where as the list has to take them out before where-to-sql sees them — it knows columns
 * of `transactions` and throws on a relation path. The tiles are about the inwestycja / pracownik,
 * not about the audit list, so dropping is the right answer there rather than a re-aim.
 */
export function stripOriginalScopedFilters(where: Where): Where {
  return mapWhereLeaves(where, (field, condition) =>
    field.startsWith(ORIGINAL_PATH_PREFIX) ? undefined : [field, condition],
  )
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

/**
 * The Where a page's own tiles take, given the Where its list took. Both strips, in this order, and
 * neither is optional: where-to-sql knows columns of `transactions`, so it throws on the dotted
 * paths the first one removes, and it hardcodes `cancelled IS NOT TRUE`, which the second one stops
 * double-applying. Exported as one call because two pages were spelling out the composition and a
 * third would have had to know the order.
 */
export function statsWhereFrom(where: Where): Where {
  return stripCancelledFilters(stripOriginalScopedFilters(where))
}
