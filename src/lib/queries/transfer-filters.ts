import type { Where } from 'payload'
import type { ResolvedSearchParamsT } from '@/types/page'
import { isTransferType, PAYMENT_METHODS } from '@/lib/constants/transfers'
import { isPayoutStatus } from '@/lib/constants/payout-confirmation'
import { parseNumericIds } from '@/lib/utils/parse-numeric-ids'
import type { ClosedDateRangeT } from '@/lib/utils/date-range'

type UserContextT = {
  id: number
  onlyOwnTransfers?: boolean
}

function getStringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

type AmountSearchT = { mode: 'prefix'; text: string } | { mode: 'range'; low: number; high: number }

/**
 * Matching by VALUE is the point: a stored 18.00 renders as "18", so no text prefix of "18,00" could
 * match it.
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

const NO_RESULTS = { equals: -1 } as const

export function buildTransferFilters(
  searchParams: ResolvedSearchParamsT,
  userContext: UserContextT,
): Where {
  const where: Where = {}

  if (userContext.onlyOwnTransfers) {
    where.createdBy = { equals: userContext.id }
  }

  const cancelledTransactionAudit = getStringParam(searchParams.cancelledTransactionAudit) === '1'

  const showCancelled =
    getStringParam(searchParams.showCancelled) === '1' || cancelledTransactionAudit

  const typeParam = getStringParam(searchParams.type)
  const requestedTypes = typeParam ? typeParam.split(',').filter(isTransferType) : null

  if (cancelledTransactionAudit) {
    where.type = { in: ['CANCELLATION'] }
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

  const payoutStatusParam = getStringParam(searchParams.payoutStatus)
  if (payoutStatusParam) {
    const statuses = payoutStatusParam.split(',').filter(isPayoutStatus)
    if (statuses.length > 0) where.payoutStatus = { in: statuses }
    else where.id = NO_RESULTS
  }

  const expenseCategoryParam = getStringParam(searchParams.expenseCategory)
  const expenseCategoryIds = parseNumericIds(expenseCategoryParam)
  if (expenseCategoryIds.length > 0) where.expenseCategory = { in: expenseCategoryIds }
  else if (expenseCategoryParam) where.id = NO_RESULTS

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

// Routed through the Typ param rather than overwriting `where.type`, so audit mode re-aims it at the
// cancelled original like any other Typ scope.
export function buildPayoutFilters(
  searchParams: ResolvedSearchParamsT,
  userContext: UserContextT,
): Where {
  return buildTransferFilters({ ...searchParams, type: 'PAYOUT' }, userContext)
}

export function narrowToTransferIds(
  where: Where,
  transferIds: number[],
  { throughOriginal = false }: { throughOriginal?: boolean } = {},
): Where {
  const ids = transferIds.length > 0 ? { in: transferIds } : NO_RESULTS
  const field = throughOriginal ? 'cancelledTransaction' : 'id'
  return andWith(where, { [field]: ids })
}

/**
 * A top-level `or` moves into the `and` list: Payload's drizzle parseParams keeps only the LAST of a
 * top-level `or` and `and`, so leaving both drops one silently.
 */
export function andWith(where: Where, ...conditions: Where[]): Where {
  const { or, and = [], ...rest } = where
  return { ...rest, and: [...and, ...(or ? [{ or }] : []), ...conditions] }
}

const ORIGINAL_PATH_PREFIX = 'cancelledTransaction.'

type WhereLeafT = Where[string]

const isBranch = (field: string, condition: WhereLeafT): condition is Where[] =>
  (field === 'or' || field === 'and') && Array.isArray(condition)

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
  'paymentMethod',
  'payoutStatus',
] as const

export function scopeAuditThroughOriginal(where: Where): Where {
  return mapWhereLeaves(where, (field, condition) =>
    (FIELDS_ONLY_THE_ORIGINAL_CARRIES as readonly string[]).includes(field)
      ? [`${ORIGINAL_PATH_PREFIX}${field}`, condition]
      : [field, condition],
  )
}

/**
 * The tile goes through where-to-sql, which throws on a dotted path, so it cannot be re-aimed the way
 * the list is — the caller drops it rather than render a confident 0,00 zł beside a populated list.
 */
export function scopeNarrowsByOriginalOnlyField(where: Where): boolean {
  return someWhereLeaf(
    where,
    (field) =>
      (FIELDS_ONLY_THE_ORIGINAL_CARRIES as readonly string[]).includes(field) ||
      field.startsWith(ORIGINAL_PATH_PREFIX),
  )
}

export function stripOriginalScopedFilters(where: Where): Where {
  return mapWhereLeaves(where, (field, condition) =>
    field.startsWith(ORIGINAL_PATH_PREFIX) ? undefined : [field, condition],
  )
}

export function withoutDateRange(where: Where): Where {
  return mapWhereLeaves(where, (field, condition) =>
    field === 'date' ? undefined : [field, condition],
  )
}

/**
 * A swap, not an intersection: the invoice dialog's range is the answer to „which dates", so the
 * table's own Od/Do narrowing it further would hand back an empty archive for a month the table isn't
 * showing.
 */
export function withDateRange(where: Where, { from, to }: ClosedDateRangeT): Where {
  const undated = withoutDateRange(where)
  const dateWindow: Where = { date: { greater_than_equal: from, less_than_equal: to } }
  return Object.keys(undated).length > 0 ? { and: [undated, dateWindow] } : dateWindow
}

/**
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
 * Both strips, and neither is optional: where-to-sql knows columns of `transactions`, so it throws on
 * the dotted paths the first one removes, and it hardcodes `cancelled IS NOT TRUE`, which the second
 * one stops double-applying.
 */
export function statsWhereFrom(where: Where): Where {
  return stripCancelledFilters(stripOriginalScopedFilters(where))
}
